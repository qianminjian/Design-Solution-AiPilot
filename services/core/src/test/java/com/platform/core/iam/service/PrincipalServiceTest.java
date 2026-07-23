package com.platform.core.iam.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.dto.CreatePrincipalRequest;
import com.platform.core.iam.dto.PrincipalDto;
import com.platform.core.iam.dto.UpdatePrincipalRequest;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.TenantRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * PrincipalService 单元测试
 * 覆盖核心业务规则：租户存在校验、邮箱唯一性、密码加密、主体更新、越权防护
 */
@ExtendWith(MockitoExtension.class)
class PrincipalServiceTest {

    @Mock
    private PrincipalRepository principalRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private ObjectMapper objectMapper = new ObjectMapper();

    private PrincipalService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID principalId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID otherTenantId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new PrincipalService(principalRepository, tenantRepository, passwordEncoder, objectMapper);
    }

    @Nested
    @DisplayName("创建主体")
    class CreatePrincipal {

        @Test
        @DisplayName("应该在租户不存在时抛出业务异常")
        void shouldThrowWhenTenantNotFound() {
            when(tenantRepository.existsById(tenantId)).thenReturn(false);

            CreatePrincipalRequest request = new CreatePrincipalRequest(
                    "test@example.com", "Test User", "password123", "USER", "en", "UTC", null, null
            );

            assertThatThrownBy(() -> service.createPrincipal(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.TENANT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在邮箱已存在时抛出业务异常")
        void shouldThrowWhenEmailAlreadyExists() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(principalRepository.existsByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(true);

            CreatePrincipalRequest request = new CreatePrincipalRequest(
                    "test@example.com", "Test User", "password123", "USER", "en", "UTC", null, null
            );

            assertThatThrownBy(() -> service.createPrincipal(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_ALREADY_EXISTS);
        }

        @Test
        @DisplayName("应该成功创建主体并加密密码")
        void shouldCreatePrincipalSuccessfully() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(principalRepository.existsByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(false);
            when(passwordEncoder.encode("password123")).thenReturn("encoded-password");

            Principal savedPrincipal = new Principal();
            savedPrincipal.setId(principalId);
            savedPrincipal.setTenantId(tenantId);
            savedPrincipal.setEmail("test@example.com");
            savedPrincipal.setDisplayName("Test User");
            savedPrincipal.setPasswordHash("encoded-password");
            savedPrincipal.setType("USER");
            savedPrincipal.setStatus("ACTIVE");
            savedPrincipal.setLocale("en");
            savedPrincipal.setTimezone("UTC");

            when(principalRepository.save(any(Principal.class))).thenReturn(savedPrincipal);

            CreatePrincipalRequest request = new CreatePrincipalRequest(
                    "test@example.com", "Test User", "password123", "USER", "en", "UTC", null, null
            );

            PrincipalDto dto = service.createPrincipal(tenantId, request);

            assertThat(dto.id()).isEqualTo(principalId);
            assertThat(dto.email()).isEqualTo("test@example.com");
            assertThat(dto.displayName()).isEqualTo("Test User");
            assertThat(dto.type()).isEqualTo("USER");
            assertThat(dto.status()).isEqualTo("ACTIVE");

            ArgumentCaptor<Principal> captor = ArgumentCaptor.forClass(Principal.class);
            verify(principalRepository).save(captor.capture());
            Principal captured = captor.getValue();
            assertThat(captured.getPasswordHash()).isEqualTo("encoded-password");
        }

        @Test
        @DisplayName("应该使用默认值填充可选字段")
        void shouldUseDefaultsForOptionalFields() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(principalRepository.existsByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(false);
            when(passwordEncoder.encode("password123")).thenReturn("encoded-password");

            Principal savedPrincipal = new Principal();
            savedPrincipal.setId(principalId);
            savedPrincipal.setTenantId(tenantId);
            savedPrincipal.setEmail("test@example.com");
            savedPrincipal.setDisplayName("Test User");
            savedPrincipal.setPasswordHash("encoded-password");
            savedPrincipal.setType("USER");
            savedPrincipal.setStatus("ACTIVE");
            savedPrincipal.setLocale("en");
            savedPrincipal.setTimezone("UTC");

            when(principalRepository.save(any(Principal.class))).thenReturn(savedPrincipal);

            CreatePrincipalRequest request = new CreatePrincipalRequest(
                    "test@example.com", "Test User", "password123", null, null, null, null, null
            );

            PrincipalDto dto = service.createPrincipal(tenantId, request);

            assertThat(dto.type()).isEqualTo("USER");
            assertThat(dto.locale()).isEqualTo("en");
            assertThat(dto.timezone()).isEqualTo("UTC");
        }
    }

    @Nested
    @DisplayName("查询主体")
    class GetPrincipal {

        @Test
        @DisplayName("应该成功查询主体")
        void shouldGetPrincipalSuccessfully() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setEmail("test@example.com");
            principal.setDisplayName("Test User");
            principal.setType("USER");
            principal.setStatus("ACTIVE");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            PrincipalDto dto = service.getPrincipal(tenantId, principalId);

            assertThat(dto.id()).isEqualTo(principalId);
            assertThat(dto.email()).isEqualTo("test@example.com");
        }

        @Test
        @DisplayName("应该在主体不存在时抛出业务异常")
        void shouldThrowWhenPrincipalNotFound() {
            when(principalRepository.findById(principalId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPrincipal(tenantId, principalId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在主体属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenPrincipalBelongsToOtherTenant() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(otherTenantId);

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            assertThatThrownBy(() -> service.getPrincipal(tenantId, principalId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该分页查询主体列表")
        void shouldListPrincipalsWithPagination() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setEmail("test@example.com");

            Pageable pageable = PageRequest.of(0, 10);
            Page<Principal> page = new PageImpl<>(List.of(principal));
            when(principalRepository.findByTenantId(tenantId, pageable)).thenReturn(page);

            Page<PrincipalDto> result = service.listPrincipals(tenantId, pageable);

            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent().get(0).email()).isEqualTo("test@example.com");
        }
    }

    @Nested
    @DisplayName("更新主体")
    class UpdatePrincipal {

        @Test
        @DisplayName("应该成功更新主体字段")
        void shouldUpdatePrincipalSuccessfully() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setDisplayName("旧名称");
            principal.setStatus("ACTIVE");
            principal.setLocale("en");
            principal.setTimezone("UTC");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
            when(principalRepository.save(any(Principal.class))).thenReturn(principal);

            UpdatePrincipalRequest request = new UpdatePrincipalRequest(
                    "新名称", "ON_HOLD", "zh", "Asia/Shanghai", null
            );

            PrincipalDto dto = service.updatePrincipal(tenantId, principalId, request);

            assertThat(dto.displayName()).isEqualTo("新名称");
            assertThat(dto.status()).isEqualTo("ON_HOLD");
            assertThat(dto.locale()).isEqualTo("zh");
            assertThat(dto.timezone()).isEqualTo("Asia/Shanghai");
        }

        @Test
        @DisplayName("应该在主体不存在时抛出业务异常")
        void shouldThrowWhenPrincipalNotFound() {
            when(principalRepository.findById(principalId)).thenReturn(Optional.empty());

            UpdatePrincipalRequest request = new UpdatePrincipalRequest("新名称", null, null, null, null);

            assertThatThrownBy(() -> service.updatePrincipal(tenantId, principalId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在主体属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenPrincipalBelongsToOtherTenant() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(otherTenantId);

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            UpdatePrincipalRequest request = new UpdatePrincipalRequest("新名称", null, null, null, null);

            assertThatThrownBy(() -> service.updatePrincipal(tenantId, principalId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该只更新非 null 字段")
        void shouldOnlyUpdateNonNullFields() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setDisplayName("旧名称");
            principal.setStatus("ACTIVE");
            principal.setLocale("en");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
            when(principalRepository.save(any(Principal.class))).thenReturn(principal);

            UpdatePrincipalRequest request = new UpdatePrincipalRequest("新名称", null, null, null, null);

            PrincipalDto dto = service.updatePrincipal(tenantId, principalId, request);

            assertThat(dto.displayName()).isEqualTo("新名称");
            assertThat(dto.status()).isEqualTo("ACTIVE");
            assertThat(dto.locale()).isEqualTo("en");
        }
    }
}