package com.platform.core.iam.service;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.UserPreferences;
import com.platform.core.iam.dto.UpdateUserPreferencesRequest;
import com.platform.core.iam.dto.UserPreferencesDto;
import com.platform.core.iam.repository.UserPreferencesRepository;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * UserPreferencesService 单元测试
 *
 * 覆盖：
 * - GET：数据库无记录时返回内存默认值
 * - GET：数据库有记录时返回实际记录
 * - PUT：数据库无记录时执行 upsert 创建
 * - PUT：数据库有记录时执行更新
 * - 安全：无认证上下文抛 IllegalStateException
 * - 安全：principal 类型不匹配抛 IllegalStateException
 *
 * 权威源：UserPreferencesService.java
 */
@DisplayName("UserPreferencesService 偏好设置服务")
@ExtendWith(MockitoExtension.class)
class UserPreferencesServiceTest {

    @Mock
    private UserPreferencesRepository repository;

    private UserPreferencesService service;

    private final UUID principalId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() {
        service = new UserPreferencesService(repository);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("GET 数据库无记录时应返回内存默认值（不持久化）")
    void getMyPreferences_shouldReturnDefaultWhenNoRecord() {
        // Arrange
        setAuthentication(principalId, tenantId);
        when(repository.findByPrincipalId(principalId)).thenReturn(Optional.empty());

        // Act
        UserPreferencesDto result = service.getMyPreferences();

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.principalId()).isEqualTo(principalId);
        assertThat(result.unitSystem()).isEqualTo("metric");
        assertThat(result.currency()).isEqualTo("CNY");
        assertThat(result.theme()).isEqualTo("light");
        assertThat(result.emailNotify()).isTrue();
        assertThat(result.inAppNotify()).isTrue();
        assertThat(result.dailyDigest()).isFalse();
        assertThat(result.mentionNotify()).isTrue();
        assertThat(result.showAiSafetyBanner()).isTrue();
        assertThat(result.requireHumanReviewBadge()).isTrue();
        // 默认值 DTO id/createdAt/updatedAt 应为 null（未持久化）
        assertThat(result.id()).isNull();
        assertThat(result.createdAt()).isNull();
        assertThat(result.updatedAt()).isNull();
        // 不应执行 save（GET 不应有副作用）
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("GET 数据库有记录时应返回实际记录")
    void getMyPreferences_shouldReturnPersistedRecordWhenExists() {
        // Arrange
        setAuthentication(principalId, tenantId);
        UserPreferences entity = buildPersistedEntity();
        when(repository.findByPrincipalId(principalId)).thenReturn(Optional.of(entity));

        // Act
        UserPreferencesDto result = service.getMyPreferences();

        // Assert
        assertThat(result.id()).isEqualTo(entity.getId());
        assertThat(result.theme()).isEqualTo("dark");
        assertThat(result.currency()).isEqualTo("USD");
        assertThat(result.dailyDigest()).isTrue();
        assertThat(result.showAiSafetyBanner()).isFalse();
    }

    @Test
    @DisplayName("PUT 数据库无记录时应执行 upsert 创建")
    void updateMyPreferences_shouldCreateWhenNoRecord() {
        // Arrange
        setAuthentication(principalId, tenantId);
        when(repository.findByPrincipalId(principalId)).thenReturn(Optional.empty());
        // save 返回传入的 entity（模拟 JPA 行为，附加 id 与时间戳）
        when(repository.save(any(UserPreferences.class))).thenAnswer(invocation -> {
            UserPreferences saved = invocation.getArgument(0);
            // 模拟持久化后字段填充
            return saved;
        });

        UpdateUserPreferencesRequest request = buildRequest("imperial", "USD", "dark",
                false, false, true, false, false, false);

        // Act
        UserPreferencesDto result = service.updateMyPreferences(request);

        // Assert：验证传入 save 的实体字段
        ArgumentCaptor<UserPreferences> captor = ArgumentCaptor.forClass(UserPreferences.class);
        verify(repository).save(captor.capture());
        UserPreferences saved = captor.getValue();
        assertThat(saved.getPrincipalId()).isEqualTo(principalId);
        assertThat(saved.getTenantId()).isEqualTo(tenantId);
        assertThat(saved.getUnitSystem()).isEqualTo("imperial");
        assertThat(saved.getCurrency()).isEqualTo("USD");
        assertThat(saved.getTheme()).isEqualTo("dark");
        assertThat(saved.getEmailNotify()).isFalse();
        assertThat(saved.getDailyDigest()).isTrue();
        assertThat(saved.getShowAiSafetyBanner()).isFalse();

        // 返回 DTO 字段对齐
        assertThat(result.theme()).isEqualTo("dark");
        assertThat(result.currency()).isEqualTo("USD");
    }

    @Test
    @DisplayName("PUT 数据库有记录时应执行更新")
    void updateMyPreferences_shouldUpdateWhenRecordExists() {
        // Arrange
        setAuthentication(principalId, tenantId);
        UserPreferences existing = buildPersistedEntity();
        when(repository.findByPrincipalId(principalId)).thenReturn(Optional.of(existing));
        when(repository.save(any(UserPreferences.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateUserPreferencesRequest request = buildRequest("imperial", "EUR", "system",
                false, false, true, false, false, false);

        // Act
        UserPreferencesDto result = service.updateMyPreferences(request);

        // Assert：验证更新到已存在的实体（不是新建）
        ArgumentCaptor<UserPreferences> captor = ArgumentCaptor.forClass(UserPreferences.class);
        verify(repository).save(captor.capture());
        UserPreferences saved = captor.getValue();
        // 应保留原有 id（更新而非新建）
        assertThat(saved.getId()).isEqualTo(existing.getId());
        assertThat(saved.getTheme()).isEqualTo("system");
        assertThat(saved.getCurrency()).isEqualTo("EUR");
        assertThat(saved.getUnitSystem()).isEqualTo("imperial");

        // 返回 DTO
        assertThat(result.theme()).isEqualTo("system");
    }

    @Test
    @DisplayName("PUT 应将所有请求字段应用到实体（含通知与 AI 安全开关）")
    void updateMyPreferences_shouldApplyAllFieldsToEntity() {
        // Arrange
        setAuthentication(principalId, tenantId);
        when(repository.findByPrincipalId(principalId)).thenReturn(Optional.of(buildPersistedEntity()));
        when(repository.save(any(UserPreferences.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateUserPreferencesRequest request = buildRequest(
                "imperial", "USD", "dark",
                /*emailNotify*/ false, /*inAppNotify*/ false,
                /*dailyDigest*/ true, /*mentionNotify*/ false,
                /*showAiSafetyBanner*/ false, /*requireHumanReviewBadge*/ false);

        // Act
        service.updateMyPreferences(request);

        // Assert：所有字段被应用
        ArgumentCaptor<UserPreferences> captor = ArgumentCaptor.forClass(UserPreferences.class);
        verify(repository).save(captor.capture());
        UserPreferences saved = captor.getValue();
        assertThat(saved.getEmailNotify()).isFalse();
        assertThat(saved.getInAppNotify()).isFalse();
        assertThat(saved.getDailyDigest()).isTrue();
        assertThat(saved.getMentionNotify()).isFalse();
        assertThat(saved.getShowAiSafetyBanner()).isFalse();
        assertThat(saved.getRequireHumanReviewBadge()).isFalse();
    }

    @Test
    @DisplayName("GET 无认证上下文时应抛 IllegalStateException")
    void getMyPreferences_shouldThrowWhenNoAuthentication() {
        // Arrange
        SecurityContextHolder.clearContext();

        // Act + Assert
        assertThatThrownBy(() -> service.getMyPreferences())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("未找到认证上下文");
        verify(repository, never()).findByPrincipalId(any());
    }

    @Test
    @DisplayName("PUT principal 类型不匹配时应抛 IllegalStateException")
    void updateMyPreferences_shouldThrowWhenPrincipalTypeMismatch() {
        // Arrange：使用字符串作为 principal（类型不匹配）
        Authentication auth = new UsernamePasswordAuthenticationToken(
                "anonymous-string-principal", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        UpdateUserPreferencesRequest request = buildRequest(
                "metric", "CNY", "light",
                true, true, false, true, true, true);

        // Act + Assert
        assertThatThrownBy(() -> service.updateMyPreferences(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("认证主体类型不匹配");
        verify(repository, never()).save(any());
    }

    // ---------- 辅助方法 ----------

    private void setAuthentication(UUID principalId, UUID tenantId) {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com",
                List.of("DESIGNER"), "session-001",
                Instant.now(), Instant.now().plusSeconds(300));
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private UserPreferences buildPersistedEntity() {
        UserPreferences entity = new UserPreferences();
        entity.setId(UUID.fromString("44444444-4444-4444-4444-444444444444"));
        entity.setPrincipalId(principalId);
        entity.setTenantId(tenantId);
        entity.setUnitSystem("metric");
        entity.setCurrency("USD");
        entity.setTheme("dark");
        entity.setEmailNotify(true);
        entity.setInAppNotify(true);
        entity.setDailyDigest(true);
        entity.setMentionNotify(true);
        entity.setShowAiSafetyBanner(false);
        entity.setRequireHumanReviewBadge(true);
        return entity;
    }

    private UpdateUserPreferencesRequest buildRequest(
            String unitSystem, String currency, String theme,
            Boolean emailNotify, Boolean inAppNotify,
            Boolean dailyDigest, Boolean mentionNotify,
            Boolean showAiSafetyBanner, Boolean requireHumanReviewBadge) {
        return new UpdateUserPreferencesRequest(
                unitSystem, currency, theme,
                emailNotify, inAppNotify, dailyDigest, mentionNotify,
                showAiSafetyBanner, requireHumanReviewBadge);
    }
}
