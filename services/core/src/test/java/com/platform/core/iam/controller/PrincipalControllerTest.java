package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.dto.CreatePrincipalRequest;
import com.platform.core.iam.dto.PrincipalDto;
import com.platform.core.iam.dto.UpdatePrincipalRequest;
import com.platform.core.iam.service.PrincipalService;
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
 * 主体控制器单元测试
 *
 * 覆盖：创建、详情、分页查询、更新。
 */
@ExtendWith(MockitoExtension.class)
class PrincipalControllerTest {

    @Mock
    private PrincipalService principalService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private PrincipalController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID principalId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new PrincipalController(principalService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建主体应该返回 201 状态码")
    void createShouldReturn201() {
        // Arrange
        CreatePrincipalRequest request = new CreatePrincipalRequest(
                "zhangsan@example.com", "张三", "password123", "USER", "zh-CN", "Asia/Shanghai", null, Map.of());
        PrincipalDto dto = buildPrincipalDto();
        when(principalService.createPrincipal(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<PrincipalDto>> response = controller.create(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(principalId);
        verify(principalService).createPrincipal(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("GET /{id} 应该返回主体详情")
    void getShouldReturnPrincipalDetail() {
        // Arrange
        PrincipalDto dto = buildPrincipalDto();
        when(principalService.getPrincipal(eq(tenantId), eq(principalId))).thenReturn(dto);

        // Act
        ApiResponse<PrincipalDto> response = controller.get(principalId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(principalId);
        verify(principalService).getPrincipal(eq(tenantId), eq(principalId));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listShouldReturnPageResponse() {
        // Arrange
        PrincipalDto dto = buildPrincipalDto();
        Page<PrincipalDto> page = new PageImpl<>(List.of(dto));
        when(principalService.listPrincipals(eq(tenantId), any(Pageable.class))).thenReturn(page);

        // Act
        PageResponse<PrincipalDto> response = controller.list(1, 20, httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(principalService).listPrincipals(eq(tenantId), any(Pageable.class));
    }

    @Test
    @DisplayName("PATCH /{id} 应该调用 Service 更新主体")
    void updateShouldInvokeService() {
        // Arrange
        UpdatePrincipalRequest request = new UpdatePrincipalRequest(
                "李四", "ACTIVE", "zh-CN", "Asia/Shanghai", Map.of());
        PrincipalDto dto = buildPrincipalDto();
        when(principalService.updatePrincipal(eq(tenantId), eq(principalId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<PrincipalDto> response = controller.update(principalId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(principalId);
        verify(principalService).updatePrincipal(eq(tenantId), eq(principalId), eq(request));
    }

    private PrincipalDto buildPrincipalDto() {
        Instant now = Instant.now();
        return new PrincipalDto(
                principalId, tenantId, "USER", "zhangsan@example.com", "张三",
                "ACTIVE", "zh-CN", "Asia/Shanghai", "L1", null, null,
                now, now, 1L
        );
    }
}
