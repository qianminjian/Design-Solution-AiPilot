package com.platform.core.platform.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.platform.domain.SagaInstance;
import com.platform.core.platform.domain.SagaStatus;
import com.platform.core.platform.repository.SagaInstanceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Saga 协调器
 *
 * <p>权威源：@design/D34-数据-数据库.md §3 与 @design/D35-API-事件契约.md
 *
 * <p>核心职责：
 * <ul>
 *   <li>启动 Saga 实例并持久化初始状态</li>
 *   <li>推进 Saga 步骤，记录已完成步骤（用于补偿）</li>
 *   <li>失败时转入补偿状态，记录失败原因</li>
 *   <li>完成或失败时记录终态时间戳</li>
 * </ul>
 *
 * <p>V0 裁剪说明：本协调器仅提供状态机骨架与持久化能力。
 * 具体步骤执行逻辑（如 ProjectCreationSaga 的"创建项目→创建阶段→发布事件"）
 * 由调用方在 {@code SagaStep} 实现中编排，本类不引入复杂 BPMN/状态机框架。
 */
@Service
public class SagaCoordinator {

    private static final Logger log = LoggerFactory.getLogger(SagaCoordinator.class);

    private final SagaInstanceRepository sagaRepository;

    public SagaCoordinator(SagaInstanceRepository sagaRepository) {
        this.sagaRepository = sagaRepository;
    }

    /**
     * 启动新 Saga 实例
     *
     * @param tenantId       租户 ID
     * @param sagaType       Saga 类型（如 "ProjectCreationSaga"）
     * @param aggregateType  关联聚合根类型
     * @param aggregateId     关联聚合根 ID
     * @param initialContext  初始上下文负载（可空）
     * @param traceId         追踪 ID（可空）
     * @return 已持久化的 Saga 实例（状态为 STARTED）
     */
    @Transactional
    public SagaInstance startSaga(UUID tenantId,
                                  String sagaType,
                                  String aggregateType,
                                  UUID aggregateId,
                                  Map<String, Object> initialContext,
                                  String traceId) {
        if (tenantId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "tenantId 不能为空");
        }
        if (sagaType == null || sagaType.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "sagaType 不能为空");
        }
        if (aggregateId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "aggregateId 不能为空");
        }

        SagaInstance saga = SagaInstance.start(
                tenantId, sagaType, aggregateType, aggregateId, initialContext, traceId);
        SagaInstance saved = sagaRepository.save(saga);
        log.info("Saga 启动 tenantId={} sagaType={} sagaId={} aggregateId={}",
                tenantId, sagaType, saved.getId(), aggregateId);
        return saved;
    }

    /**
     * 推进 Saga 到下一步
     *
     * @param sagaId Saga 实例 ID
     * @param nextStep 下一步名称（如 "createStages"、"publishEvent"）
     * @return 更新后的 Saga 实例
     */
    @Transactional
    public SagaInstance advanceStep(UUID sagaId, String nextStep) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        assertRunning(saga);
        saga.advanceTo(nextStep);
        SagaInstance saved = sagaRepository.save(saga);
        log.debug("Saga 步骤推进 sagaId={} nextStep={} completedSteps={}",
                sagaId, nextStep, saved.getCompletedSteps());
        return saved;
    }

    /**
     * 标记 Saga 完成
     *
     * @param sagaId Saga 实例 ID
     * @return 更新后的 Saga 实例（状态为 COMPLETED）
     */
    @Transactional
    public SagaInstance completeSaga(UUID sagaId) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        assertRunning(saga);
        saga.markCompleted();
        SagaInstance saved = sagaRepository.save(saga);
        log.info("Saga 完成 sagaId={} completedSteps={}", sagaId, saved.getCompletedSteps());
        return saved;
    }

    /**
     * 标记 Saga 进入补偿阶段
     *
     * @param sagaId Saga 实例 ID
     * @param error  失败原因
     * @return 更新后的 Saga 实例（状态为 COMPENSATING）
     */
    @Transactional
    public SagaInstance startCompensation(UUID sagaId, String error) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        assertRunning(saga);
        saga.markCompensating(error);
        SagaInstance saved = sagaRepository.save(saga);
        log.warn(" Saga 进入补偿 sagaId={} error={} completedSteps={}",
                sagaId, error, saved.getCompletedSteps());
        return saved;
    }

    /**
     * 标记 Saga 补偿成功（终态）
     *
     * @param sagaId Saga 实例 ID
     * @return 更新后的 Saga 实例（状态为 COMPENSATED）
     */
    @Transactional
    public SagaInstance completeCompensation(UUID sagaId) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        if (saga.getStatus() != SagaStatus.COMPENSATING) {
            throw new BusinessException(ErrorCode.INVALID_SAGA_STATUS,
                    "Saga 不在补偿中，无法标记补偿完成: " + saga.getStatus());
        }
        saga.markCompensated();
        SagaInstance saved = sagaRepository.save(saga);
        log.info("Saga 补偿完成 sagaId={}", sagaId);
        return saved;
    }

    /**
     * 标记 Saga 失败（补偿失败，需人工介入，终态）
     *
     * @param sagaId Saga 实例 ID
     * @param error  失败原因
     * @return 更新后的 Saga 实例（状态为 FAILED）
     */
    @Transactional
    public SagaInstance failSaga(UUID sagaId, String error) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        saga.markFailed(error);
        SagaInstance saved = sagaRepository.save(saga);
        log.error("Saga 失败 sagaId={} error={}", sagaId, error);
        return saved;
    }

    /**
     * 中止 Saga（业务主动取消，终态）
     *
     * @param sagaId Saga 实例 ID
     * @param reason 中止原因
     * @return 更新后的 Saga 实例（状态为 ABORTED）
     */
    @Transactional
    public SagaInstance abortSaga(UUID sagaId, String reason) {
        SagaInstance saga = loadSagaOrThrow(sagaId);
        assertRunning(saga);
        saga.markAborted(reason);
        SagaInstance saved = sagaRepository.save(saga);
        log.warn("Saga 已中止 sagaId={} reason={}", sagaId, reason);
        return saved;
    }

    /**
     * 查询 Saga 详情
     */
    @Transactional(readOnly = true)
    public SagaInstance getSaga(UUID sagaId) {
        return loadSagaOrThrow(sagaId);
    }

    /**
     * 按聚合根查询 Saga 历史
     */
    @Transactional(readOnly = true)
    public List<SagaInstance> listSagasByAggregate(UUID tenantId, String aggregateType, UUID aggregateId) {
        return sagaRepository.findByTenantIdAndAggregateTypeAndAggregateIdOrderByStartedAtDesc(
                tenantId, aggregateType, aggregateId);
    }

    private SagaInstance loadSagaOrThrow(UUID sagaId) {
        return sagaRepository.findById(sagaId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.SAGA_NOT_FOUND,
                        "Saga 实例不存在: " + sagaId));
    }

    private void assertRunning(SagaInstance saga) {
        if (saga.getStatus() != SagaStatus.STARTED) {
            throw new BusinessException(ErrorCode.INVALID_SAGA_STATUS,
                    "Saga 不在 STARTED 状态，当前状态: " + saga.getStatus());
        }
    }
}
