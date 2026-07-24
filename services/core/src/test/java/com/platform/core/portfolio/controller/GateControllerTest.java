package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.service.GateService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 门禁控制器单元测试
 *
 * 覆盖：列表查询、门禁决策。
 */
@ExtendWith(MockitoExtension.class)
class GateControllerTest {

    @Mock
    private GateService gateService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private GateController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID gateId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID baselineId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new GateController(gateService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("GET 应该返回项目门禁列表")
    void listShouldReturnGateList() {
        // Arrange
        GateDecisionDto dto = buildGateDto();
        when(gateService.listGates(eq(tenantId), eq(projectId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<GateDecisionDto>> response = controller.list(projectId, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(gateService).listGates(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("POST /{gateId}:decide 应该调用 Service 提交门禁决策")
    void decideShouldInvokeService() {
        // Arrange
        DecideGateRequest request = new DecideGateRequest(
                "APPROVED", "方案设计通过评审", baselineId, List.of("review-doc-001"));
        GateDecisionDto dto = buildGateDto();
        when(gateService.decideGate(eq(tenantId), eq(projectId), eq(gateId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<GateDecisionDto> response = controller.decide(projectId, gateId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(gateId);
        verify(gateService).decideGate(eq(tenantId), eq(projectId), eq(gateId), eq(request));
    }

    private GateDecisionDto buildGateDto() {
        Instant now = Instant.now();
        return new GateDecisionDto(
                gateId, tenantId, projectId, UUID.randomUUID(),
                "GATE-002", "方案设计评审门控",
                "DECIDED", "APPROVED", now, userId, baselineId,
                "方案设计通过评审", "L3", "[]", "{}",
                now, now, 1L
        );
    }
}
