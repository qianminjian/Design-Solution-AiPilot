package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.dto.CreateOrganizationRequest;
import com.platform.core.iam.dto.OrganizationDto;
import com.platform.core.iam.service.OrganizationService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 组织控制器单元测试
 *
 * 覆盖：创建、详情、分页查询。
 */
@ExtendWith(MockitoExtension.class)
class OrganizationControllerTest {

    @Mock
    private OrganizationService organizationService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private OrganizationController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();
    private final UUID parentId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new OrganizationController(organizationService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建组织应该返回 201 状态码")
    void createShouldReturn201() {
        // Arrange
        CreateOrganizationRequest request = new CreateOrganizationRequest(
                parentId, "建筑设计部", "DEPARTMENT", Map.of());
        OrganizationDto dto = buildOrganizationDto();
        when(organizationService.createOrganization(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<OrganizationDto>> response = controller.create(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(orgId);
        verify(organizationService).createOrganization(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("GET /{id} 应该返回组织详情")
    void getShouldReturnOrganizationDetail() {
        // Arrange
        OrganizationDto dto = buildOrganizationDto();
        when(organizationService.getOrganization(eq(tenantId), eq(orgId))).thenReturn(dto);

        // Act
        ApiResponse<OrganizationDto> response = controller.get(orgId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(orgId);
        verify(organizationService).getOrganization(eq(tenantId), eq(orgId));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listShouldReturnPageResponse() {
        // Arrange
        OrganizationDto dto = buildOrganizationDto();
        Page<OrganizationDto> page = new PageImpl<>(List.of(dto));
        when(organizationService.listOrganizations(eq(tenantId), eq(parentId), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<OrganizationDto> response =
                controller.list(parentId, 1, 20, httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(organizationService).listOrganizations(eq(tenantId), eq(parentId), any(Pageable.class));
    }

    private OrganizationDto buildOrganizationDto() {
        Instant now = Instant.now();
        return new OrganizationDto(
                orgId, tenantId, parentId, "建筑设计部", "DEPARTMENT",
                "ACTIVE", "L2", "{}", now, now, 1L
        );
    }
}
