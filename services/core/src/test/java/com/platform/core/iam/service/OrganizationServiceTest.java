package com.platform.core.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Organization;
import com.platform.core.iam.dto.CreateOrganizationRequest;
import com.platform.core.iam.dto.OrganizationDto;
import com.platform.core.iam.repository.OrganizationRepository;
import com.platform.core.iam.repository.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
 * OrganizationService 单元测试
 * 覆盖核心业务规则：租户存在校验、父组织跨租户越权防护、metadata 序列化、分页查询
 */
@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private ObjectMapper objectMapper;

    private OrganizationService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID otherTenantId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID organizationId = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private final UUID parentId = UUID.fromString("66666666-6666-6666-6666-666666666666");

    @BeforeEach
    void setUp() {
        service = new OrganizationService(organizationRepository, tenantRepository, objectMapper);
    }

    @Nested
    @DisplayName("创建组织")
    class CreateOrganization {

        @Test
        @DisplayName("应该在租户不存在时抛出业务异常")
        void shouldThrowWhenTenantNotFound() {
            when(tenantRepository.existsById(tenantId)).thenReturn(false);

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    null, "总部", null, null);

            assertThatThrownBy(() -> service.createOrganization(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.TENANT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在父组织不存在时抛出业务异常")
        void shouldThrowWhenParentNotFound() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(organizationRepository.findById(parentId)).thenReturn(Optional.empty());

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    parentId, "子部门", null, null);

            assertThatThrownBy(() -> service.createOrganization(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在父组织属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenParentBelongsToOtherTenant() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);

            Organization parent = new Organization();
            parent.setId(parentId);
            parent.setTenantId(otherTenantId);
            when(organizationRepository.findById(parentId)).thenReturn(Optional.of(parent));

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    parentId, "子部门", null, null);

            assertThatThrownBy(() -> service.createOrganization(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在 metadata 序列化失败时抛出业务异常")
        void shouldThrowWhenMetadataSerializationFails() throws Exception {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(objectMapper.writeValueAsString(any()))
                    .thenThrow(new JsonProcessingException("boom") {
                    });

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    null, "总部", "COMPANY", Map.of("k", "v"));

            assertThatThrownBy(() -> service.createOrganization(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PARAM_INVALID);
        }

        @Test
        @DisplayName("应该成功创建顶层组织并默认 type=COMPANY")
        void shouldCreateTopLevelOrganizationWithDefaultType() throws Exception {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"k\":\"v\"}");

            Organization saved = buildSavedOrganization();
            saved.setName("总部");
            saved.setType("COMPANY");
            when(organizationRepository.save(any(Organization.class))).thenReturn(saved);

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    null, "总部", null, Map.of("k", "v"));

            OrganizationDto dto = service.createOrganization(tenantId, request);

            assertThat(dto.id()).isEqualTo(organizationId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.name()).isEqualTo("总部");
            assertThat(dto.type()).isEqualTo("COMPANY");
            assertThat(dto.status()).isEqualTo("ACTIVE");
            assertThat(dto.parentId()).isNull();

            ArgumentCaptor<Organization> captor = ArgumentCaptor.forClass(Organization.class);
            verify(organizationRepository).save(captor.capture());
            Organization captured = captor.getValue();
            assertThat(captured.getTenantId()).isEqualTo(tenantId);
            assertThat(captured.getType()).isEqualTo("COMPANY");
            assertThat(captured.getStatus()).isEqualTo("ACTIVE");
            assertThat(captured.getMetadata()).isEqualTo("{\"k\":\"v\"}");
        }

        @Test
        @DisplayName("应该成功创建带父组织的子部门")
        void shouldCreateChildOrganizationWithParent() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);

            Organization parent = new Organization();
            parent.setId(parentId);
            parent.setTenantId(tenantId);
            when(organizationRepository.findById(parentId)).thenReturn(Optional.of(parent));

            Organization saved = buildSavedOrganization();
            saved.setName("研发部");
            saved.setType("DEPARTMENT");
            saved.setParentId(parentId);
            when(organizationRepository.save(any(Organization.class))).thenReturn(saved);

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    parentId, "研发部", "DEPARTMENT", null);

            OrganizationDto dto = service.createOrganization(tenantId, request);

            assertThat(dto.parentId()).isEqualTo(parentId);
            assertThat(dto.type()).isEqualTo("DEPARTMENT");
        }

        @Test
        @DisplayName("metadata 为 null 时应直接使用 {} 不调用 ObjectMapper")
        void shouldUseEmptyObjectForNullMetadata() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);

            Organization saved = buildSavedOrganization();
            when(organizationRepository.save(any(Organization.class))).thenReturn(saved);

            CreateOrganizationRequest request = new CreateOrganizationRequest(
                    null, "总部", "COMPANY", null);

            service.createOrganization(tenantId, request);

            ArgumentCaptor<Organization> captor = ArgumentCaptor.forClass(Organization.class);
            verify(organizationRepository).save(captor.capture());
            assertThat(captor.getValue().getMetadata()).isEqualTo("{}");
        }
    }

    @Nested
    @DisplayName("查询组织")
    class GetOrganization {

        @Test
        @DisplayName("应该成功查询组织")
        void shouldGetOrganizationSuccessfully() {
            Organization org = buildSavedOrganization();
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.of(org));

            OrganizationDto dto = service.getOrganization(tenantId, organizationId);

            assertThat(dto.id()).isEqualTo(organizationId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.name()).isEqualTo("总部");
        }

        @Test
        @DisplayName("应该在组织不存在时抛出业务异常")
        void shouldThrowWhenOrganizationNotFound() {
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getOrganization(tenantId, organizationId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在组织属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenOrganizationBelongsToOtherTenant() {
            Organization org = buildSavedOrganization();
            org.setTenantId(otherTenantId);
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.of(org));

            assertThatThrownBy(() -> service.getOrganization(tenantId, organizationId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("分页查询组织列表")
    class ListOrganizations {

        @Test
        @DisplayName("parentId 为 null 时应查询顶层组织")
        void shouldListTopLevelOrganizationsWhenParentIdIsNull() {
            Pageable pageable = PageRequest.of(0, 10);
            Organization org = buildSavedOrganization();
            Page<Organization> page = new PageImpl<>(List.of(org), pageable, 1);

            when(organizationRepository.findByTenantIdAndParentIdIsNull(tenantId, pageable))
                    .thenReturn(page);

            Page<OrganizationDto> result = service.listOrganizations(tenantId, null, pageable);

            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id()).isEqualTo(organizationId);

            verify(organizationRepository).findByTenantIdAndParentIdIsNull(tenantId, pageable);
        }

        @Test
        @DisplayName("parentId 不为 null 时应查询该父组织的子组织")
        void shouldListChildOrganizationsWhenParentIdProvided() {
            Pageable pageable = PageRequest.of(0, 10);
            Organization child = buildSavedOrganization();
            child.setParentId(parentId);
            Page<Organization> page = new PageImpl<>(List.of(child), pageable, 1);

            when(organizationRepository.findByTenantIdAndParentId(tenantId, parentId, pageable))
                    .thenReturn(page);

            Page<OrganizationDto> result = service.listOrganizations(tenantId, parentId, pageable);

            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent().get(0).parentId()).isEqualTo(parentId);

            verify(organizationRepository).findByTenantIdAndParentId(eq(tenantId), eq(parentId), eq(pageable));
        }

        @Test
        @DisplayName("无数据时应返回空页")
        void shouldReturnEmptyPageWhenNoOrganizations() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<Organization> empty = new PageImpl<>(List.of(), pageable, 0);

            when(organizationRepository.findByTenantIdAndParentIdIsNull(tenantId, pageable))
                    .thenReturn(empty);

            Page<OrganizationDto> result = service.listOrganizations(tenantId, null, pageable);

            assertThat(result.getTotalElements()).isZero();
            assertThat(result.getContent()).isEmpty();
        }
    }

    // ── 测试辅助方法 ──────────────────────────────────────────

    private Organization buildSavedOrganization() {
        Organization org = new Organization();
        org.setId(organizationId);
        org.setTenantId(tenantId);
        org.setName("总部");
        org.setType("COMPANY");
        org.setStatus("ACTIVE");
        org.setMetadata("{}");
        return org;
    }
}
