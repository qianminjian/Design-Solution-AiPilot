package com.platform.core.workflow.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.portfolio.support.StageDefinitions;
import com.platform.core.workflow.domain.WorkflowStageInstance;
import com.platform.core.workflow.repository.WorkflowStageInstanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * StageWorkflowService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>阶段列表查询（按状态/编码过滤、租户隔离）</li>
 *   <li>阶段状态流转（合法流转、终态校验、startedAt/completedAt 自动填充）</li>
 *   <li>阶段不存在异常</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class StageWorkflowServiceTest {

    @Mock
    private WorkflowStageInstanceRepository stageInstanceRepository;

    private StageWorkflowService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID stageId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new StageWorkflowService(stageInstanceRepository);
    }

    @Nested
    @DisplayName("查询阶段列表")
    class ListStages {

        @Test
        @DisplayName("应该按 stageOrder 升序返回阶段列表")
        void shouldReturnStagesByStageOrder() {
            WorkflowStageInstance s1 = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            WorkflowStageInstance s2 = buildStage(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    tenantId, projectId, "STG-P1", 1);

            when(stageInstanceRepository.findByProjectIdOrderByStageOrder(projectId))
                    .thenReturn(List.of(s1, s2));

            List<StageInstanceDto> result = service.listStageInstances(tenantId, projectId, null, null);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).stageCode()).isEqualTo("STG-P0");
            assertThat(result.get(1).stageCode()).isEqualTo("STG-P1");
        }

        @Test
        @DisplayName("应该支持按状态过滤阶段列表")
        void shouldFilterByStatus() {
            WorkflowStageInstance s1 = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            s1.setStatus(StageDefinitions.STATUS_ACTIVE);

            when(stageInstanceRepository.findByProjectIdAndStatus(projectId, StageDefinitions.STATUS_ACTIVE))
                    .thenReturn(List.of(s1));

            List<StageInstanceDto> result = service.listStageInstances(
                    tenantId, projectId, StageDefinitions.STATUS_ACTIVE, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).status()).isEqualTo(StageDefinitions.STATUS_ACTIVE);
        }

        @Test
        @DisplayName("应该支持按阶段编码过滤")
        void shouldFilterByStageCode() {
            WorkflowStageInstance s1 = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            WorkflowStageInstance s2 = buildStage(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    tenantId, projectId, "STG-P1", 1);

            when(stageInstanceRepository.findByProjectIdOrderByStageOrder(projectId))
                    .thenReturn(List.of(s1, s2));

            List<StageInstanceDto> result = service.listStageInstances(
                    tenantId, projectId, null, "STG-P1");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).stageCode()).isEqualTo("STG-P1");
        }

        @Test
        @DisplayName("应该过滤掉其他租户的阶段")
        void shouldFilterOutOtherTenants() {
            WorkflowStageInstance own = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            WorkflowStageInstance other = buildStage(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    UUID.randomUUID(), projectId, "STG-P1", 1);

            when(stageInstanceRepository.findByProjectIdOrderByStageOrder(projectId))
                    .thenReturn(List.of(own, other));

            List<StageInstanceDto> result = service.listStageInstances(tenantId, projectId, null, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).tenantId()).isEqualTo(tenantId);
        }
    }

    @Nested
    @DisplayName("阶段状态流转")
    class TransitionStage {

        @Test
        @DisplayName("应该成功流转 NOT_STARTED → ACTIVE 并自动填充 startedAt")
        void shouldTransitionToActiveAndFillStartedAt() {
            WorkflowStageInstance stage = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            stage.setStatus(StageDefinitions.STATUS_NOT_STARTED);
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.of(stage));
            when(stageInstanceRepository.save(any(WorkflowStageInstance.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            StageInstanceDto dto = service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_ACTIVE, "启动阶段"));

            assertThat(dto.status()).isEqualTo(StageDefinitions.STATUS_ACTIVE);
            assertThat(dto.startedAt()).isNotNull();
            verify(stageInstanceRepository).save(stage);
        }

        @Test
        @DisplayName("应该成功流转 ACTIVE → CLOSED 并自动填充 completedAt")
        void shouldTransitionToClosedAndFillCompletedAt() {
            WorkflowStageInstance stage = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            stage.setStatus(StageDefinitions.STATUS_APPROVED);
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.of(stage));
            when(stageInstanceRepository.save(any(WorkflowStageInstance.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            StageInstanceDto dto = service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_CLOSED, "关闭阶段"));

            assertThat(dto.status()).isEqualTo(StageDefinitions.STATUS_CLOSED);
            assertThat(dto.completedAt()).isNotNull();
        }

        @Test
        @DisplayName("应该在阶段不存在时抛出 STAGE_NOT_FOUND 异常")
        void shouldThrowWhenStageNotFound() {
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_ACTIVE, null)))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.STAGE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在终态阶段流转时抛出 INVALID_STAGE_TRANSITION 异常")
        void shouldThrowWhenTransitionFromTerminal() {
            WorkflowStageInstance stage = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            stage.setStatus(StageDefinitions.STATUS_CLOSED);
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.of(stage));

            assertThatThrownBy(() -> service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_ACTIVE, null)))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_STAGE_TRANSITION);
        }

        @Test
        @DisplayName("应该在非法状态流转时抛出 INVALID_STAGE_TRANSITION 异常")
        void shouldThrowWhenInvalidTransition() {
            WorkflowStageInstance stage = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            // NOT_STARTED → APPROVED 不在状态机中
            stage.setStatus(StageDefinitions.STATUS_NOT_STARTED);
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.of(stage));

            assertThatThrownBy(() -> service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_APPROVED, null)))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_STAGE_TRANSITION);
        }

        @Test
        @DisplayName("应该保留已有 startedAt 不被覆盖")
        void shouldNotOverrideExistingStartedAt() {
            WorkflowStageInstance stage = buildStage(stageId, tenantId, projectId, "STG-P0", 0);
            stage.setStatus(StageDefinitions.STATUS_PLANNED);
            Instant originalStarted = Instant.parse("2026-01-01T00:00:00Z");
            stage.setStartedAt(originalStarted);
            when(stageInstanceRepository.findByIdAndTenantId(stageId, tenantId))
                    .thenReturn(Optional.of(stage));
            when(stageInstanceRepository.save(any(WorkflowStageInstance.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            StageInstanceDto dto = service.transitionStage(
                    tenantId, stageId,
                    new TransitionStageRequest(StageDefinitions.STATUS_ACTIVE, "恢复"));

            assertThat(dto.startedAt()).isEqualTo(originalStarted);
        }
    }

    // ── 辅助方法 ──

    private WorkflowStageInstance buildStage(UUID id, UUID tenantId, UUID projectId,
                                              String stageCode, int stageOrder) {
        WorkflowStageInstance s = new WorkflowStageInstance();
        s.setId(id);
        s.setTenantId(tenantId);
        s.setProjectId(projectId);
        s.setStageCode(stageCode);
        s.setStageName(stageCode + "名称");
        s.setStageOrder(stageOrder);
        s.setStatus(StageDefinitions.STATUS_NOT_STARTED);
        return s;
    }
}
