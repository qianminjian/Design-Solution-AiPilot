package com.platform.core.iam.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.dto.ApiTokenDto;
import com.platform.core.iam.dto.CreateApiTokenRequest;
import com.platform.core.iam.dto.CreateApiTokenResponse;
import com.platform.core.iam.dto.RevokeApiTokenRequest;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * ApiTokenService 单元测试
 *
 * <p>覆盖：
 * <ul>
 *   <li>GET listMyTokens：空列表 / 有记录</li>
 *   <li>POST createToken：成功生成明文 + 哈希 + 盐 + prefix</li>
 *   <li>POST createToken：过期时间无效 / 超 90 天 / 名称重复</li>
 *   <li>DELETE revokeToken：成功软撤销</li>
 *   <li>DELETE revokeToken：撤销他人 Token 拒绝</li>
 *   <li>DELETE revokeToken：重复撤销拒绝</li>
 *   <li>安全：无认证上下文抛 IllegalStateException</li>
 * </ul>
 *
 * <p>权威源：ApiTokenService.java + security.md §1 密钥管理
 */
@DisplayName("ApiTokenService API Token 服务")
@ExtendWith(MockitoExtension.class)
class ApiTokenServiceTest {

    @Mock
    private ApiTokenRepository repository;

    private ApiTokenService service;

    private final UUID principalId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID otherPrincipalId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @BeforeEach
    void setUp() {
        service = new ApiTokenService(repository, new ObjectMapper());
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // ===== GET listMyTokens =====

    @Test
    @DisplayName("GET 数据库无记录时应返回空列表")
    void listMyTokens_shouldReturnEmptyListWhenNoRecord() {
        // Arrange
        setAuthentication(principalId, tenantId);
        when(repository.findByPrincipalIdOrderByCreatedAtDesc(principalId)).thenReturn(List.of());

        // Act
        List<ApiTokenDto> result = service.listMyTokens();

        // Assert
        assertThat(result).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("GET 数据库有记录时应返回 DTO 列表（不含明文 token）")
    void listMyTokens_shouldReturnDtoListWhenRecordsExist() {
        // Arrange
        setAuthentication(principalId, tenantId);
        ApiToken entity = buildPersistedToken("CI/CD Pipeline", "active");
        when(repository.findByPrincipalIdOrderByCreatedAtDesc(principalId))
                .thenReturn(List.of(entity));

        // Act
        List<ApiTokenDto> result = service.listMyTokens();

        // Assert
        assertThat(result).hasSize(1);
        ApiTokenDto dto = result.get(0);
        assertThat(dto.id()).isEqualTo(entity.getId());
        assertThat(dto.name()).isEqualTo("CI/CD Pipeline");
        assertThat(dto.prefix()).isEqualTo("abc123def456");
        assertThat(dto.scopes()).containsExactly("read:projects", "write:documents");
        assertThat(dto.status()).isEqualTo("active");
        // DTO 不应包含 token_hash / token_salt / 明文 token
        // （DTO 字段定义决定，无这些字段即可证明）
    }

    // ===== POST createToken =====

    @Test
    @DisplayName("POST 应生成明文 token + 独立盐 + SHA-256 哈希 + prefix")
    void createToken_shouldGeneratePlainTokenSaltHashAndPrefix() {
        // Arrange
        setAuthentication(principalId, tenantId);
        when(repository.findByPrincipalIdAndNameAndStatus(principalId, "Test Token", "active"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ApiToken.class))).thenAnswer(invocation -> {
            ApiToken saved = invocation.getArgument(0);
            saved.setId(UUID.fromString("66666666-6666-6666-6666-666666666666"));
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            saved.setRowVersion(1L);
            return saved;
        });

        CreateApiTokenRequest request = new CreateApiTokenRequest(
                "Test Token",
                List.of("read:projects"),
                Instant.now().plus(Duration.ofDays(30)).toString()
        );

        // Act
        CreateApiTokenResponse response = service.createToken(request);

        // Assert：响应中包含明文 token（仅本次返回）
        assertThat(response.plainToken()).isNotNull().hasSize(64);
        assertThat(response.prefix()).hasSize(12);
        // prefix 应是 plainToken 的前 12 位
        assertThat(response.prefix()).isEqualTo(response.plainToken().substring(0, 12));
        assertThat(response.name()).isEqualTo("Test Token");
        assertThat(response.scopes()).containsExactly("read:projects");
        assertThat(response.status()).isEqualTo("active");

        // Assert：保存到 DB 的实体不包含明文 token
        ArgumentCaptor<ApiToken> captor = ArgumentCaptor.forClass(ApiToken.class);
        verify(repository).save(captor.capture());
        ApiToken savedEntity = captor.getValue();
        assertThat(savedEntity.getTokenHash()).isNotEqualTo(response.plainToken());
        assertThat(savedEntity.getTokenHash()).hasSize(64); // SHA-256 hex
        assertThat(savedEntity.getTokenSalt()).hasSize(32); // 16 bytes hex
        assertThat(savedEntity.getPrincipalId()).isEqualTo(principalId);
        assertThat(savedEntity.getTenantId()).isEqualTo(tenantId);
        assertThat(savedEntity.getScopes()).isEqualTo("[\"read:projects\"]");
    }

    @Test
    @DisplayName("POST 过期时间早于当前时间 + 60 秒时应抛 IllegalArgumentException")
    void createToken_shouldThrowWhenExpiresAtTooSoon() {
        // Arrange
        setAuthentication(principalId, tenantId);
        CreateApiTokenRequest request = new CreateApiTokenRequest(
                "Test Token",
                List.of("read:projects"),
                Instant.now().toString()  // 当前时间，早于 now + 60s
        );

        // Act + Assert
        assertThatThrownBy(() -> service.createToken(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("过期时间必须晚于当前时间至少 60 秒");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("POST 过期时间超过 90 天时应抛 IllegalArgumentException")
    void createToken_shouldThrowWhenExpiresExceeds90Days() {
        // Arrange
        setAuthentication(principalId, tenantId);
        CreateApiTokenRequest request = new CreateApiTokenRequest(
                "Test Token",
                List.of("read:projects"),
                Instant.now().plus(Duration.ofDays(91)).toString()
        );

        // Act + Assert
        assertThatThrownBy(() -> service.createToken(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Token 有效期不能超过 90 天");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("POST 同主体下名称已存在时应抛 IllegalStateException")
    void createToken_shouldThrowWhenNameDuplicate() {
        // Arrange
        setAuthentication(principalId, tenantId);
        ApiToken existing = buildPersistedToken("Test Token", "active");
        when(repository.findByPrincipalIdAndNameAndStatus(principalId, "Test Token", "active"))
                .thenReturn(Optional.of(existing));

        CreateApiTokenRequest request = new CreateApiTokenRequest(
                "Test Token",
                List.of("read:projects"),
                Instant.now().plus(Duration.ofDays(30)).toString()
        );

        // Act + Assert
        assertThatThrownBy(() -> service.createToken(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Token 名称已存在");
        verify(repository, never()).save(any());
    }

    // ===== DELETE revokeToken =====

    @Test
    @DisplayName("DELETE 应成功软撤销自己的 Token（status=revoked + revokedAt + revokedReason）")
    void revokeToken_shouldSoftRevokeOwnToken() {
        // Arrange
        setAuthentication(principalId, tenantId);
        ApiToken entity = buildPersistedToken("Old Token", "active");
        when(repository.findById(entity.getId())).thenReturn(Optional.of(entity));
        when(repository.save(any(ApiToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevokeApiTokenRequest request = new RevokeApiTokenRequest("怀疑泄露");

        // Act
        ApiTokenDto result = service.revokeToken(entity.getId(), request);

        // Assert
        assertThat(result.status()).isEqualTo("revoked");
        assertThat(result.revokedAt()).isNotNull();
        assertThat(result.revokedReason()).isEqualTo("怀疑泄露");

        // 验证实体字段被正确更新
        ArgumentCaptor<ApiToken> captor = ArgumentCaptor.forClass(ApiToken.class);
        verify(repository).save(captor.capture());
        ApiToken saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo("revoked");
        assertThat(saved.getRevokedAt()).isNotNull();
        assertThat(saved.getRevokedReason()).isEqualTo("怀疑泄露");
    }

    @Test
    @DisplayName("DELETE 撤销他人 Token 应抛 IllegalStateException")
    void revokeToken_shouldThrowWhenRevokingOthersToken() {
        // Arrange
        setAuthentication(principalId, tenantId);
        ApiToken othersToken = buildPersistedToken("Other's Token", "active");
        othersToken.setPrincipalId(otherPrincipalId);  // 别人的 Token
        when(repository.findById(othersToken.getId())).thenReturn(Optional.of(othersToken));

        RevokeApiTokenRequest request = new RevokeApiTokenRequest(null);

        // Act + Assert
        assertThatThrownBy(() -> service.revokeToken(othersToken.getId(), request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("无权撤销他人的 Token");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("DELETE 重复撤销已 revoked 的 Token 应抛 IllegalStateException")
    void revokeToken_shouldThrowWhenTokenAlreadyRevoked() {
        // Arrange
        setAuthentication(principalId, tenantId);
        ApiToken entity = buildPersistedToken("Old Token", "revoked");
        when(repository.findById(entity.getId())).thenReturn(Optional.of(entity));

        RevokeApiTokenRequest request = new RevokeApiTokenRequest(null);

        // Act + Assert
        assertThatThrownBy(() -> service.revokeToken(entity.getId(), request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Token 已撤销，不可重复操作");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("DELETE Token 不存在时应抛 IllegalArgumentException")
    void revokeToken_shouldThrowWhenTokenNotFound() {
        // Arrange
        setAuthentication(principalId, tenantId);
        UUID notExistId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        when(repository.findById(notExistId)).thenReturn(Optional.empty());

        RevokeApiTokenRequest request = new RevokeApiTokenRequest(null);

        // Act + Assert
        assertThatThrownBy(() -> service.revokeToken(notExistId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Token 不存在");
        verify(repository, never()).save(any());
    }

    // ===== 安全：无认证上下文 =====

    @Test
    @DisplayName("GET 无认证上下文时应抛 IllegalStateException")
    void listMyTokens_shouldThrowWhenNoAuthentication() {
        // Arrange
        SecurityContextHolder.clearContext();

        // Act + Assert
        assertThatThrownBy(() -> service.listMyTokens())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("未找到认证上下文");
        verify(repository, never()).findByPrincipalIdOrderByCreatedAtDesc(any());
    }

    // ===== 辅助方法 =====

    private void setAuthentication(UUID principalId, UUID tenantId) {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com",
                List.of("DESIGNER"), "session-001",
                Instant.now(), Instant.now().plusSeconds(300));
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private ApiToken buildPersistedToken(String name, String status) {
        ApiToken entity = new ApiToken();
        entity.setId(UUID.fromString("66666666-6666-6666-6666-666666666666"));
        entity.setPrincipalId(principalId);
        entity.setTenantId(tenantId);
        entity.setName(name);
        entity.setPrefix("abc123def456");
        entity.setTokenHash("aabbccdd00112233445566778899aabbccdd00112233445566778899aabbccdd");
        entity.setTokenSalt("00112233445566778899001122334455");
        entity.setScopes("[\"read:projects\",\"write:documents\"]");
        entity.setStatus(status);
        entity.setExpiresAt(Instant.now().plus(Duration.ofDays(30)));
        entity.setCreatedAt(Instant.now().minus(Duration.ofDays(10)));
        entity.setUpdatedAt(Instant.now().minus(Duration.ofDays(1)));
        entity.setRowVersion(1L);
        return entity;
    }
}
