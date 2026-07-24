package com.platform.core.workflow.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.workflow.service.StageWorkflowService;
import com.platform.core.workflow.service.WorkflowBaselineService;
import com.platform.core.workflow.service.WorkflowGateService;
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
 * 工作流控制器单元测试
 *
 * 覆盖：阶段实例列表/流转、门控决策列表/决策、基线列表/详情/冻结。
 */
@ExtendWith(MockitoExtension.class)
class WorkflowControllerTest {

    @Mock
    private StageWorkflowService stageWorkflowService;

    @Mock
    private WorkflowGateService gateService;

    @Mock
    private WorkflowBaselineService baselineService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private WorkflowController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID stageId = UUID.randomUUID();
    private final UUID gateId = UUID.randomUUID();
    private final UUID baselineId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new WorkflowController(stageWorkflowService, gateService, baselineService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("GET /stages 应该返回项目阶段实例列表")
    void listStagesShouldReturnStageList() {
        // Arrange
        StageInstanceDto dto = buildStageDto();
        when(stageWorkflowService.listStageInstances(eq(tenantId), eq(projectId), eq("IN_PROGRESS"), eq("SCHEME")))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<StageInstanceDto>> response =
                controller.listStages(projectId, "IN_PROGRESS", "SCHEME", httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(stageWorkflowService).listStageInstances(eq(tenantId), eq(projectId), eq("IN_PROGRESS"), eq("SCHEME"));
    }

    @Test
    @DisplayName("POST /stages/{stageId}:transition 应该调用 Service 流转阶段状态")
    void transitionStageShouldInvokeService() {
        // Arrange
        TransitionStageRequest request = new TransitionStageRequest("IN_PROGRESS", "进入方案设计阶段");
        StageInstanceDto dto = buildStageDto();
        when(stageWorkflowService.transitionStage(eq(tenantId), eq(stageId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<StageInstanceDto> response =
                controller.transitionStage(stageId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(stageId);
        verify(stageWorkflowService).transitionStage(eq(tenantId), eq(stageId), eq(request));
    }

    @Test
    @DisplayName("GET /gates 应该返回门控决策列表")
    void listGatesShouldReturnGateDecisions() {
        // Arrange
        GateDecisionDto dto = buildGateDto();
        when(gateService.listGateDecisions(eq(tenantId), eq(stageId), eq("PENDING"), eq(null)))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<GateDecisionDto>> response =
                controller.listGates(stageId, "PENDING", null, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(gateService).listGateDecisions(eq(tenantId), eq(stageId), eq("PENDING"), eq(null));
    }

    @Test
    @DisplayName("POST /gates/{gateId}:decide 应该调用 Service 提交门控决策")
    void decideGateShouldInvokeService() {
        // Arrange
        DecideGateRequest request = new DecideGateRequest(
                "APPROVED", "方案设计通过评审", baselineId, List.of("review-doc-001"));
        GateDecisionDto dto = buildGateDto();
        when(gateService.decideGate(eq(tenantId), eq(gateId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<GateDecisionDto> response = controller.decideGate(gateId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(gateId);
        verify(gateService).decideGate(eq(tenantId), eq(gateId), eq(request));
    }

    @Test
    @DisplayName("GET /baselines 应该返回项目基线列表")
    void listBaselinesShouldReturnBaselineList() {
        // Arrange
        ProjectBaselineDto dto = buildBaselineDto();
        when(baselineService.listBaselines(eq(tenantId), eq(projectId)))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<ProjectBaselineDto>> response =
                controller.listBaselines(projectId, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(baselineService).listBaselines(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("GET /baselines/{baselineId} 应该返回基线详情")
    void getBaselineShouldReturnDetail() {
        // Arrange
        ProjectBaselineDto dto = buildBaselineDto();
        when(baselineService.getBaseline(eq(tenantId), eq(baselineId))).thenReturn(dto);

        // Act
        ApiResponse<ProjectBaselineDto> response =
                controller.getBaseline(baselineId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(baselineId);
        verify(baselineService).getBaseline(eq(tenantId), eq(baselineId));
    }

    @Test
    @DisplayName("POST /baselines/{baselineId}:freeze 应该调用 Service 冻结基线")
    void freezeBaselineShouldInvokeService() {
        // Arrange
        ProjectBaselineDto dto = buildBaselineDto();
        when(baselineService.freezeBaseline(eq(tenantId), eq(baselineId))).thenReturn(dto);

        // Act
        ApiResponse<ProjectBaselineDto> response =
                controller.freezeBaseline(baselineId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(baselineId);
        verify(baselineService).freezeBaseline(eq(tenantId), eq(baselineId));
    }

    private StageInstanceDto buildStageDto() {
        Instant now = Instant.now();
        return new StageInstanceDto(
                stageId, tenantId, projectId, "SCHEME", "方案设计",
                2, "IN_PROGRESS", now, null, "L3", "{}",
                now, now, 1L
        );
    }

    private GateDecisionDto buildGateDto() {
        Instant now = Instant.now();
        return new GateDecisionDto(
                gateId, tenantId, projectId, stageId,
                "GATE-002", "方案设计评审门控",
                "DECIDED", "APPROVED", now, userId, baselineId,
                "方案设计通过评审", "L3", "[]", "{}",
                now, now, 1L
        );
    }

    private ProjectBaselineDto buildBaselineDto() {
        Instant now = Instant.now();
        return new ProjectBaselineDto(
                baselineId, tenantId, projectId, 1L,
                "v1.0-方案基线", "PUBLISHED", now, userId,
                "方案设计阶段冻结基线", "L3", "{}",
                now, now, 1L
        );
    }
}
