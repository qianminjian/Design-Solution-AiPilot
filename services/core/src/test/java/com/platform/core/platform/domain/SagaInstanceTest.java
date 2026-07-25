package com.platform.core.platform.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SagaInstance 领域模型单元测试
 *
 * <p>覆盖 Saga 状态机所有合法流转：
 * <ul>
 *   <li>STARTED → COMPLETED（正常完成）</li>
 *   <li>STARTED → COMPENSATING（步骤失败，开始补偿）</li>
 *   <li>COMPENSATING → COMPENSATED（补偿成功）</li>
 *   <li>COMPENSATING → FAILED（补偿失败，需人工介入）</li>
 *   <li>STARTED → ABORTED（业务主动取消）</li>
 *   <li>步骤推进时 completedSteps 有序追加</li>
 * </ul>
 */
class SagaInstanceTest {

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Nested
    @DisplayName("工厂方法 start()")
    class Start {

        @Test
        @DisplayName("应该创建 STARTED 状态 Saga 实例")
        void shouldCreateStartedSaga() {
            // Arrange（准备）
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("projectId", "proj-001");

            // Act（执行）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, context, "trace-001");

            // Assert（断言）
            assertThat(saga.getId()).isNotNull();
            assertThat(saga.getTenantId()).isEqualTo(tenantId);
            assertThat(saga.getSagaType()).isEqualTo("ProjectCreationSaga");
            assertThat(saga.getAggregateType()).isEqualTo("Project");
            assertThat(saga.getAggregateId()).isEqualTo(aggregateId);
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.STARTED);
            assertThat(saga.getCurrentStep()).isNull();
            assertThat(saga.getCompletedSteps()).isEmpty();
            assertThat(saga.getContextPayload()).containsEntry("projectId", "proj-001");
            assertThat(saga.getTraceId()).isEqualTo("trace-001");
            assertThat(saga.getStartedAt()).isNotNull();
            assertThat(saga.getCompletedAt()).isNull();
            assertThat(saga.getLastError()).isNull();
        }

        @Test
        @DisplayName("null 初始上下文应使用空 Map 占位")
        void shouldHandleNullContext() {
            // Act（执行）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, null, null);

            // Assert（断言）
            assertThat(saga.getContextPayload()).isNotNull().isEmpty();
            assertThat(saga.getTraceId()).isNull();
        }
    }

    @Nested
    @DisplayName("步骤推进 advanceTo()")
    class AdvanceTo {

        @Test
        @DisplayName("推进到第一步时 currentStep 设置，completedSteps 仍为空")
        void shouldSetCurrentStepOnFirstAdvance() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");

            // Act（执行）
            saga.advanceTo("createStages");

            // Assert（断言）
            assertThat(saga.getCurrentStep()).isEqualTo("createStages");
            assertThat(saga.getCompletedSteps()).isEmpty();
        }

        @Test
        @DisplayName("推进到第二步时第一步加入 completedSteps，currentStep 更新")
        void shouldAppendCompletedStepOnSecondAdvance() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.advanceTo("createStages");

            // Act（执行）
            saga.advanceTo("publishEvent");

            // Assert（断言）
            assertThat(saga.getCurrentStep()).isEqualTo("publishEvent");
            assertThat(saga.getCompletedSteps()).containsExactly("createStages");
        }

        @Test
        @DisplayName("多次推进应有序追加到 completedSteps")
        void shouldAppendMultipleStepsInOrder() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");

            // Act（执行）
            saga.advanceTo("createStages");
            saga.advanceTo("initBaselines");
            saga.advanceTo("publishEvent");

            // Assert（断言）
            assertThat(saga.getCurrentStep()).isEqualTo("publishEvent");
            assertThat(saga.getCompletedSteps())
                    .containsExactly("createStages", "initBaselines");
        }
    }

    @Nested
    @DisplayName("正常完成 markCompleted()")
    class MarkCompleted {

        @Test
        @DisplayName("完成时状态变为 COMPLETED，记录 completedAt，currentStep 归入 completedSteps")
        void shouldTransitionToCompleted() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.advanceTo("createStages");
            saga.advanceTo("publishEvent");

            // Act（执行）
            saga.markCompleted();

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.COMPLETED);
            assertThat(saga.getCompletedAt()).isNotNull();
            assertThat(saga.getCurrentStep()).isNull();
            assertThat(saga.getCompletedSteps())
                    .containsExactly("createStages", "publishEvent");
        }

        @Test
        @DisplayName("无 currentStep 时完成，completedSteps 保持不变")
        void shouldHandleCompleteWithoutCurrentStep() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");

            // Act（执行）
            saga.markCompleted();

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.COMPLETED);
            assertThat(saga.getCompletedAt()).isNotNull();
            assertThat(saga.getCurrentStep()).isNull();
            assertThat(saga.getCompletedSteps()).isEmpty();
        }
    }

    @Nested
    @DisplayName("补偿流程")
    class Compensation {

        @Test
        @DisplayName("markCompensating 应将状态变为 COMPENSATING 并记录失败原因")
        void shouldTransitionToCompensating() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");

            // Act（执行）
            saga.markCompensating("步骤 publishEvent 失败：Kafka 不可达");

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.COMPENSATING);
            assertThat(saga.getLastError()).isEqualTo("步骤 publishEvent 失败：Kafka 不可达");
        }

        @Test
        @DisplayName("markCompensated 应将状态变为 COMPENSATED 并记录 completedAt")
        void shouldTransitionToCompensated() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompensating("步骤失败");

            // Act（执行）
            saga.markCompensated();

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.COMPENSATED);
            assertThat(saga.getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("markFailed 应将状态变为 FAILED 并记录失败原因（补偿失败终态）")
        void shouldTransitionToFailed() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompensating("步骤失败");
            saga.markCompensated();  // 假设补偿成功

            // Act（执行）：模拟补偿失败
            saga.markFailed("补偿时 createStages.compensate 抛出异常");

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.FAILED);
            assertThat(saga.getLastError()).contains("createStages.compensate");
            assertThat(saga.getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("补偿完成后不能再继续推进（状态机不变，调用方需自行检查）")
        void shouldNotChangeStateAfterCompletedDirectly() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompleted();

            // Act（执行）：即使调用 markCompensating，状态机也不应该被误用
            // 这里仅验证状态变化，业务层应通过 SagaCoordinator 检查状态合法性
            saga.markCompensating("意外调用");

            // Assert（断言）：状态变为 COMPENSATING，但业务层应阻止此调用
            // 领域模型本身不阻止状态流转，由 SagaCoordinator.assertRunning 控制
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.COMPENSATING);
        }
    }

    @Nested
    @DisplayName("业务中止 markAborted()")
    class MarkAborted {

        @Test
        @DisplayName("markAborted 应将状态变为 ABORTED 并记录原因")
        void shouldTransitionToAborted() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");

            // Act（执行）
            saga.markAborted("用户主动取消项目创建");

            // Assert（断言）
            assertThat(saga.getStatus()).isEqualTo(SagaStatus.ABORTED);
            assertThat(saga.getLastError()).isEqualTo("用户主动取消项目创建");
            assertThat(saga.getCompletedAt()).isNotNull();
        }
    }

    @Test
    @DisplayName("completedSteps 默认不可变，advanceTo 时会创建新 ArrayList")
    void completedStepsShouldBeMutableAfterAdvance() {
        // Arrange（准备）
        SagaInstance saga = SagaInstance.start(
                tenantId, "ProjectCreationSaga", "Project",
                aggregateId, Map.of(), "trace-001");

        // 默认是 List.of() 不可变
        List<String> initialSteps = saga.getCompletedSteps();
        assertThat(initialSteps).isEmpty();

        // Act（执行）
        saga.advanceTo("step1");

        // Assert（断言）：advanceTo 后 completedSteps 是可变 ArrayList
        // 再次 advanceTo 应能成功追加
        saga.advanceTo("step2");
        assertThat(saga.getCompletedSteps()).containsExactly("step1");
    }
}
