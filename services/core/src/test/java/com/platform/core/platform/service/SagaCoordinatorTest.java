package com.platform.core.platform.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.platform.domain.SagaInstance;
import com.platform.core.platform.domain.SagaStatus;
import com.platform.core.platform.repository.SagaInstanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * SagaCoordinator 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>startSaga 参数校验与状态机初始化</li>
 *   <li>advanceStep 步骤推进（STARTED 状态前置校验）</li>
 *   <li>completeSaga 完成 Saga</li>
 *   <li>compensateSaga 补偿流程</li>
 *   <li>abortSaga 中止 Saga</li>
 *   <li>Saga 不存在 / 状态非法时抛出对应错误码</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class SagaCoordinatorTest {

    @Mock
    private SagaInstanceRepository sagaRepository;

    private SagaCoordinator coordinator;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID sagaId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        coordinator = new SagaCoordinator(sagaRepository);
    }

    @Nested
    @DisplayName("startSaga()")
    class StartSaga {

        @Test
        @DisplayName("应该创建 STARTED 状态 Saga 并持久化")
        void shouldStartNewSaga() {
            // Arrange（准备）
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("projectCode", "P-001");
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.startSaga(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, context, "trace-001");

            // Assert（断言）
            ArgumentCaptor<SagaInstance> captor = ArgumentCaptor.forClass(SagaInstance.class);
            verify(sagaRepository).save(captor.capture());
            SagaInstance saved = captor.getValue();

            assertThat(saved.getTenantId()).isEqualTo(tenantId);
            assertThat(saved.getSagaType()).isEqualTo("ProjectCreationSaga");
            assertThat(saved.getAggregateType()).isEqualTo("Project");
            assertThat(saved.getAggregateId()).isEqualTo(aggregateId);
            assertThat(saved.getStatus()).isEqualTo(SagaStatus.STARTED);
            assertThat(saved.getContextPayload()).containsEntry("projectCode", "P-001");
            assertThat(saved.getTraceId()).isEqualTo("trace-001");

            assertThat(result).isSameAs(saved);
        }

        @Test
        @DisplayName("null 初始上下文应使用空 Map 占位")
        void shouldHandleNullContext() {
            // Arrange（准备）
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.startSaga(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, null, null);

            // Assert（断言）
            assertThat(result.getContextPayload()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("null tenantId 应抛出 PARAM_MISSING")
        void shouldThrowWhenTenantIdIsNull() {
            assertThatThrownBy(() -> coordinator.startSaga(
                    null, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }

        @Test
        @DisplayName("空白 sagaType 应抛出 PARAM_MISSING")
        void shouldThrowWhenSagaTypeIsBlank() {
            assertThatThrownBy(() -> coordinator.startSaga(
                    tenantId, "  ", "Project",
                    aggregateId, Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }

        @Test
        @DisplayName("null aggregateId 应抛出 PARAM_MISSING")
        void shouldThrowWhenAggregateIdIsNull() {
            assertThatThrownBy(() -> coordinator.startSaga(
                    tenantId, "ProjectCreationSaga", "Project",
                    null, Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }
    }

    @Nested
    @DisplayName("advanceStep()")
    class AdvanceStep {

        @Test
        @DisplayName("应该推进 Saga 到下一步")
        void shouldAdvanceToNextStep() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.advanceStep(sagaId, "createStages");

            // Assert（断言）
            assertThat(result.getCurrentStep()).isEqualTo("createStages");
            assertThat(result.getStatus()).isEqualTo(SagaStatus.STARTED);
        }

        @Test
        @DisplayName("Saga 不存在应抛出 SAGA_NOT_FOUND")
        void shouldThrowWhenSagaNotFound() {
            // Arrange（准备）
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.advanceStep(sagaId, "step1"))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.SAGA_NOT_FOUND);
        }

        @Test
        @DisplayName("已完成 Saga 推进应抛出 INVALID_SAGA_STATUS")
        void shouldThrowWhenSagaAlreadyCompleted() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompleted();
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.advanceStep(sagaId, "step1"))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.INVALID_SAGA_STATUS);
        }
    }

    @Nested
    @DisplayName("completeSaga()")
    class CompleteSaga {

        @Test
        @DisplayName("应该将 Saga 标记为 COMPLETED")
        void shouldCompleteSaga() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.completeSaga(sagaId);

            // Assert（断言）
            assertThat(result.getStatus()).isEqualTo(SagaStatus.COMPLETED);
            assertThat(result.getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("Saga 不存在应抛出 SAGA_NOT_FOUND")
        void shouldThrowWhenSagaNotFound() {
            // Arrange（准备）
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.completeSaga(sagaId))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.SAGA_NOT_FOUND);
        }

        @Test
        @DisplayName("已 COMPLETED 的 Saga 完成应抛出 INVALID_SAGA_STATUS")
        void shouldThrowWhenAlreadyCompleted() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompleted();
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.completeSaga(sagaId))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.INVALID_SAGA_STATUS);
        }
    }

    @Nested
    @DisplayName("startCompensation()")
    class StartCompensation {

        @Test
        @DisplayName("应该将 Saga 标记为 COMPENSATING 并记录失败原因")
        void shouldTransitionToCompensating() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.startCompensation(sagaId,
                    "步骤 publishEvent 失败：Kafka 不可达");

            // Assert（断言）
            assertThat(result.getStatus()).isEqualTo(SagaStatus.COMPENSATING);
            assertThat(result.getLastError()).contains("publishEvent 失败");
        }

        @Test
        @DisplayName("Saga 不存在应抛出 SAGA_NOT_FOUND")
        void shouldThrowWhenSagaNotFound() {
            // Arrange（准备）
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.startCompensation(sagaId, "err"))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.SAGA_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("completeCompensation()")
    class CompleteCompensation {

        @Test
        @DisplayName("应该将 COMPENSATING 状态 Saga 标记为 COMPENSATED")
        void shouldTransitionToCompensated() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            saga.markCompensating("步骤失败");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.completeCompensation(sagaId);

            // Assert（断言）
            assertThat(result.getStatus()).isEqualTo(SagaStatus.COMPENSATED);
            assertThat(result.getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("非 COMPENSATING 状态调用应抛出 INVALID_SAGA_STATUS")
        void shouldThrowWhenNotInCompensatingState() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.completeCompensation(sagaId))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.INVALID_SAGA_STATUS);
        }
    }

    @Nested
    @DisplayName("failSaga()")
    class FailSaga {

        @Test
        @DisplayName("应该将 Saga 标记为 FAILED（补偿失败终态）")
        void shouldTransitionToFailed() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.failSaga(sagaId, "补偿时异常");

            // Assert（断言）
            assertThat(result.getStatus()).isEqualTo(SagaStatus.FAILED);
            assertThat(result.getLastError()).isEqualTo("补偿时异常");
            assertThat(result.getCompletedAt()).isNotNull();
        }
    }

    @Nested
    @DisplayName("abortSaga()")
    class AbortSaga {

        @Test
        @DisplayName("应该将 Saga 标记为 ABORTED")
        void shouldAbortSaga() {
            // Arrange（准备）
            SagaInstance saga = SagaInstance.start(
                    tenantId, "ProjectCreationSaga", "Project",
                    aggregateId, Map.of(), "trace-001");
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.of(saga));
            when(sagaRepository.save(any(SagaInstance.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            SagaInstance result = coordinator.abortSaga(sagaId, "用户主动取消");

            // Assert（断言）
            assertThat(result.getStatus()).isEqualTo(SagaStatus.ABORTED);
            assertThat(result.getLastError()).isEqualTo("用户主动取消");
            assertThat(result.getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("Saga 不存在应抛出 SAGA_NOT_FOUND")
        void shouldThrowWhenSagaNotFound() {
            // Arrange（准备）
            when(sagaRepository.findById(sagaId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> coordinator.abortSaga(sagaId, "reason"))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.SAGA_NOT_FOUND);
        }
    }
}
