package com.platform.core.operations.integration;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.dto.OperationsActionResponseDto;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.action.service.OperationsActionService;
import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.queue.domain.QueueTask;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
import com.platform.core.operations.worker.domain.WorkerStatus;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * OperationsActionService 集成测试
 *
 * <p>验证 OperationsActionService 危险动作约束 + 状态机 + 分发逻辑：
 * <ul>
 *   <li>executeAction：危险动作约束校验（riskLevel + stepUpToken + impactPreviewAcknowledged）</li>
 *   <li>HIGH 风险（ISOLATE）：stepUpToken + 影响预览确认必须，缺失抛 BusinessException(4220)</li>
 *   <li>IRREVERSIBLE（CANCEL）：stepUpToken + 影响预览确认必须（双人审批 V0 占位通过）</li>
 *   <li>MEDIUM 风险（RETRY）：仅需影响预览确认</li>
 *   <li>LOW 风险（RESUME）：无额外校验</li>
 *   <li>retry storm 检测：同 target 近期 FAILED >= 5 时 RETRY 拒绝</li>
 *   <li>分发到 Worker（ISOLATE/FAILOVER/PAUSE/RESUME）：调用 WorkerService</li>
 *   <li>分发到 Connector（ISOLATE/FAILOVER/RECONCILE）：调用 ConnectorService</li>
 *   <li>分发到 QueueTask（RETRY/PAUSE/RESUME/CANCEL）：调用 QueueTaskService</li>
 *   <li>状态机流转：QUEUED → RUNNING → COMPLETED（成功）或 FAILED（异常）</li>
 *   <li>审计字段持久化：operationId/auditTraceId/initiatedBy/initiatedAt</li>
 *   <li>跨租户隔离：tenantId 校验</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Service 直接调用，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17（§危险动作）
 * @design D40-信息-物理安全.md（Step-up 认证）
 * @design D35-API-事件契约.md（危险动作审计）
 */
@DisplayName("OperationsActionService 集成测试")
class OperationsActionServiceIT extends AbstractIntegrationTest {

    @Autowired
    private OperationsActionService operationsActionService;

    @Autowired
    private OperationsActionRepository operationsActionRepository;

    @Autowired
    private WorkerStatusRepository workerStatusRepository;

    @Autowired
    private ConnectorStatusRepository connectorStatusRepository;

    @Autowired
    private QueueTaskRepository queueTaskRepository;

    // ── LOW 风险动作（RESUME） ──

    /**
     * 应该成功执行 LOW 风险动作（RESUME Worker）无额外校验
     */
    @Test
    @DisplayName("应该成功执行 LOW 风险动作（RESUME Worker）无额外校验")
    void shouldExecuteLowRiskActionWithoutStepUpToken() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-resume-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-resume-001", WorkerType.AI, WorkerRuntimeStatus.STOPPED));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RESUME,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "Worker 恢复（LOW 风险，无需 stepUpToken）",
                null,  // stepUpToken 为 null
                false  // impactPreviewAcknowledged 为 false
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("ops-user-001"));

        // Assert（断言）
        assertAll(
                () -> assertEquals(OperationsActionStatus.COMPLETED, response.status(),
                        "LOW 风险动作应直接 COMPLETED"),
                () -> assertEquals(OperationsActionType.RESUME, response.actionType()),
                () -> assertNotNull(response.operationId(), "应生成 operationId"),
                () -> assertNotNull(response.auditTraceId(), "应生成 auditTraceId"),
                () -> assertEquals(1, response.affectedCount()),
                () -> assertNotNull(response.completedAt(), "completed_at 应已记录")
        );

        // 验证 Worker 状态已变更（STOPPED → IDLE）
        WorkerStatus updated = workerStatusRepository.findByIdAndTenantId(worker.getId(), tenantId).orElseThrow();
        assertEquals(WorkerRuntimeStatus.IDLE, updated.getStatus(),
                "Worker 应已 RESUME 到 IDLE 状态");
    }

    // ── MEDIUM 风险动作（RETRY） ──

    /**
     * 应该成功执行 MEDIUM 风险动作（RETRY QueueTask）仅需影响预览确认
     */
    @Test
    @DisplayName("应该成功执行 MEDIUM 风险动作（RETRY QueueTask）仅需影响预览确认")
    void shouldExecuteMediumRiskActionWithImpactPreviewOnly() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-retry-" + UUID.randomUUID());
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RETRY,
                OperationsActionTargetType.QUEUE_TASK,
                failedTask.getId().toString(),
                "AI 生成任务重试（MEDIUM 风险，仅需影响预览确认）",
                null,  // stepUpToken 为 null（MEDIUM 不强制）
                true   // impactPreviewAcknowledged 为 true
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("ops-user-002"));

        // Assert（断言）
        assertAll(
                () -> assertEquals(OperationsActionStatus.COMPLETED, response.status()),
                () -> assertEquals(OperationsActionType.RETRY, response.actionType()),
                () -> assertEquals(1, response.affectedCount())
        );

        // 验证 QueueTask 状态已变更（FAILED → QUEUED，retryCount +1）
        QueueTask updated = queueTaskRepository.findByIdAndTenantId(failedTask.getId(), tenantId).orElseThrow();
        assertAll(
                () -> assertEquals(QueueTaskStatus.QUEUED, updated.getStatus(),
                        "QueueTask 应已 RETRY 到 QUEUED 状态"),
                () -> assertEquals(1, updated.getRetryCount(),
                        "retryCount 应 +1 = 1")
        );
    }

    /**
     * 应该拒绝 MEDIUM 风险动作未确认影响预览（impactPreviewAcknowledged=false）
     */
    @Test
    @DisplayName("应该拒绝 MEDIUM 风险动作未确认影响预览")
    void shouldRejectMediumRiskActionWithoutImpactPreview() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-retry-rej-" + UUID.randomUUID());
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RETRY,
                OperationsActionTargetType.QUEUE_TASK,
                failedTask.getId().toString(),
                "重试但未确认影响预览",
                null,
                false  // impactPreviewAcknowledged 为 false
        );

        // Act + Assert（执行 + 断言）
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-003")),
                "MEDIUM 风险未确认影响预览应抛 BusinessException");

        assertAll(
                () -> assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode(),
                        "错误码应为 BUSINESS_RULE_VIOLATION"),
                () -> assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus(),
                        "HTTP 状态码应为 400"),
                () -> assertTrue(ex.getMessage().contains("MEDIUM"),
                        "错误信息应包含 MEDIUM 风险等级"),
                () -> assertTrue(ex.getMessage().contains("impactPreviewAcknowledged"),
                        "错误信息应包含 impactPreviewAcknowledged 字段名")
        );
    }

    // ── HIGH 风险动作（ISOLATE） ──

    /**
     * 应该成功执行 HIGH 风险动作（ISOLATE Worker）含 stepUpToken + 影响预览确认
     */
    @Test
    @DisplayName("应该成功执行 HIGH 风险动作（ISOLATE Worker）含 stepUpToken + 影响预览确认")
    void shouldExecuteHighRiskActionWithStepUpToken() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-isolate-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-isolate-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "Worker 心跳超时 10 分钟，自动隔离",
                "step-up-token-abc-123",  // stepUpToken 必填
                true  // impactPreviewAcknowledged 必填 true
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("ops-user-004"));

        // Assert（断言）
        assertAll(
                () -> assertEquals(OperationsActionStatus.COMPLETED, response.status()),
                () -> assertEquals(OperationsActionType.ISOLATE, response.actionType()),
                () -> assertEquals(1, response.affectedCount())
        );

        // 验证 Worker 已隔离
        WorkerStatus isolated = workerStatusRepository.findByIdAndTenantId(worker.getId(), tenantId).orElseThrow();
        assertAll(
                () -> assertTrue(isolated.isIsolated(), "Worker 应已隔离（isIsolated=true）"),
                () -> assertEquals("Worker 心跳超时 10 分钟，自动隔离", isolated.getIsolatedReason(),
                        "isolatedReason 应记录隔离原因"),
                () -> assertNotNull(isolated.getIsolatedAt(), "isolatedAt 应已记录"),
                () -> assertEquals(WorkerRuntimeStatus.STOPPED, isolated.getStatus(),
                        "隔离后状态应为 STOPPED"),
                () -> assertNull(isolated.getCurrentTaskId(), "隔离后 currentTaskId 应为 null")
        );
    }

    /**
     * 应该拒绝 HIGH 风险动作缺失 stepUpToken
     */
    @Test
    @DisplayName("应该拒绝 HIGH 风险动作缺失 stepUpToken")
    void shouldRejectHighRiskActionWithoutStepUpToken() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-isolate-rej1-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-isolate-rej-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "隔离但未提供 stepUpToken",
                null,  // stepUpToken 缺失
                true   // impactPreviewAcknowledged 已确认
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-005")),
                "HIGH 风险缺失 stepUpToken 应抛 BusinessException");

        assertAll(
                () -> assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode()),
                () -> assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus()),
                () -> assertTrue(ex.getMessage().contains("HIGH"),
                        "错误信息应包含 HIGH 风险等级"),
                () -> assertTrue(ex.getMessage().contains("stepUpToken"),
                        "错误信息应包含 stepUpToken 字段名")
        );

        // 验证 Worker 未被隔离（动作未执行）
        WorkerStatus unchanged = workerStatusRepository.findByIdAndTenantId(worker.getId(), tenantId).orElseThrow();
        assertFalse(unchanged.isIsolated(), "Worker 不应被隔离");
    }

    /**
     * 应该拒绝 HIGH 风险动作未确认影响预览
     */
    @Test
    @DisplayName("应该拒绝 HIGH 风险动作未确认影响预览")
    void shouldRejectHighRiskActionWithoutImpactPreview() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-isolate-rej2-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-isolate-rej-002", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "隔离但未确认影响预览",
                "step-up-token-abc-123",  // stepUpToken 已提供
                false  // impactPreviewAcknowledged 为 false
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-006")),
                "HIGH 风险未确认影响预览应抛 BusinessException");

        assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode());
    }

    // ── IRREVERSIBLE 风险动作（CANCEL） ──

    /**
     * 应该成功执行 IRREVERSIBLE 动作（CANCEL QueueTask）含双人审批 V0 占位通过
     */
    @Test
    @DisplayName("应该成功执行 IRREVERSIBLE 动作（CANCEL QueueTask）含双人审批 V0 占位通过")
    void shouldExecuteIrreversibleActionWithDualReviewV0Placeholder() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-cancel-" + UUID.randomUUID());
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.PUBLICATION_SEAL, QueueTaskStatus.RUNNING, QueueTaskPriority.CRITICAL));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.CANCEL,
                OperationsActionTargetType.QUEUE_TASK,
                runningTask.getId().toString(),
                "取消高风险发布签章任务：检测到 prompt 注入风险",
                "step-up-token-irreversible-001",  // IRREVERSIBLE 强制 stepUpToken
                true  // IRREVERSIBLE 强制 impactPreviewAcknowledged
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("architect-zhang@platform.com"));

        // Assert（断言）
        assertAll(
                () -> assertEquals(OperationsActionStatus.COMPLETED, response.status(),
                        "IRREVERSIBLE 动作 V0 占位通过，应 COMPLETED"),
                () -> assertEquals(OperationsActionType.CANCEL, response.actionType()),
                () -> assertEquals(1, response.affectedCount()),
                () -> assertNotNull(response.operationId()),
                () -> assertNotNull(response.auditTraceId())
        );

        // 验证审计记录已持久化（stepUpTokenHash + impactPreviewAcknowledged + riskLevel=IRREVERSIBLE）
        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(tenantId, response.operationId());
        assertTrue(saved.isPresent(), "审计记录应已持久化");
        assertAll(
                () -> assertEquals(OperationsRiskLevel.IRREVERSIBLE, saved.get().getRiskLevel(),
                        "风险等级应为 IRREVERSIBLE"),
                () -> assertNotNull(saved.get().getStepUpTokenHash(),
                        "stepUpTokenHash 应已持久化（不存储明文）"),
                () -> assertTrue(saved.get().isImpactPreviewAcknowledged(),
                        "impactPreviewAcknowledged 应为 true"),
                () -> assertEquals("architect-zhang@platform.com", saved.get().getInitiatedBy(),
                        "initiatedBy 应从 httpRequest 解析")
        );
    }

    /**
     * 应该拒绝 IRREVERSIBLE 动作缺失 stepUpToken
     */
    @Test
    @DisplayName("应该拒绝 IRREVERSIBLE 动作缺失 stepUpToken")
    void shouldRejectIrreversibleActionWithoutStepUpToken() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-cancel-rej-" + UUID.randomUUID());
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.PUBLICATION_SEAL, QueueTaskStatus.RUNNING, QueueTaskPriority.CRITICAL));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.CANCEL,
                OperationsActionTargetType.QUEUE_TASK,
                runningTask.getId().toString(),
                "取消但未提供 stepUpToken",
                null,  // stepUpToken 缺失
                true   // impactPreviewAcknowledged 已确认
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-007")),
                "IRREVERSIBLE 缺失 stepUpToken 应抛 BusinessException");

        assertAll(
                () -> assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode()),
                () -> assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus()),
                () -> assertTrue(ex.getMessage().contains("IRREVERSIBLE"),
                        "错误信息应包含 IRREVERSIBLE 风险等级")
        );
    }

    // ── retry storm 检测 ──

    /**
     * 应该检测 retry storm 并拒绝 RETRY 动作（同 target FAILED 数 >= 5）
     */
    @Test
    @DisplayName("应该检测 retry storm 并拒绝 RETRY 动作")
    void shouldDetectRetryStormAndRejectRetryAction() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-storm-" + UUID.randomUUID());
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));
        String targetId = failedTask.getId().toString();

        // 预先写入 5 条同 target 的 FAILED OperationsAction（触发阈值）
        for (int i = 0; i < 5; i++) {
            operationsActionRepository.save(buildFailedActionForRetryStorm(tenantId, targetId));
        }

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RETRY,
                OperationsActionTargetType.QUEUE_TASK,
                targetId,
                "重试触发 retry storm 检测",
                null,
                true
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-008")),
                "retry storm 应抛 BusinessException");

        assertAll(
                () -> assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode()),
                () -> assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus(),
                        "retry storm HTTP 状态码应为 409 CONFLICT"),
                () -> assertTrue(ex.getMessage().contains("retry storm"),
                        "错误信息应包含 retry storm"),
                () -> assertTrue(ex.getMessage().contains(targetId),
                        "错误信息应包含 targetId"),
                () -> assertTrue(ex.getMessage().contains("5"),
                        "错误信息应包含当前 FAILED 数 5")
        );

        // 验证 QueueTask 状态未变（动作被拒绝，未执行）
        QueueTask unchanged = queueTaskRepository.findByIdAndTenantId(failedTask.getId(), tenantId).orElseThrow();
        assertEquals(QueueTaskStatus.FAILED, unchanged.getStatus(),
                "retry storm 检测拒绝后 QueueTask 状态应保持 FAILED");
    }

    /**
     * 应该在 retry storm 阈值边界（FAILED=4）允许 RETRY 动作
     */
    @Test
    @DisplayName("应该在 retry storm 阈值边界（FAILED=4）允许 RETRY 动作")
    void shouldAllowRetryActionAtRetryStormBoundary() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-storm-bnd-" + UUID.randomUUID());
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                tenantId, QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));
        String targetId = failedTask.getId().toString();

        // 预先写入 4 条同 target 的 FAILED OperationsAction（未触发阈值，4 < 5）
        for (int i = 0; i < 4; i++) {
            operationsActionRepository.save(buildFailedActionForRetryStorm(tenantId, targetId));
        }

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RETRY,
                OperationsActionTargetType.QUEUE_TASK,
                targetId,
                "重试在 retry storm 阈值边界",
                null,
                true
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("ops-user-009"));

        // Assert（断言）— 4 < 5 阈值，RETRY 应成功
        assertEquals(OperationsActionStatus.COMPLETED, response.status(),
                "FAILED=4 未触发 retry storm 阈值（>=5），RETRY 应成功");
    }

    // ── 分发逻辑 ──

    /**
     * 应该成功分发 FAILOVER 动作到 Worker（HIGH 风险）
     */
    @Test
    @DisplayName("应该成功分发 FAILOVER 动作到 Worker")
    void shouldDispatchFailoverActionToWorker() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-failover-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-failover-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.FAILOVER,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "主实例 OOM，故障转移",
                "step-up-token-failover",
                true
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("ops-user-010"));

        // Assert（断言）
        assertEquals(OperationsActionStatus.COMPLETED, response.status());

        // 验证 Worker 状态变更（ERROR + isolatedReason 记录 FAILOVER）
        WorkerStatus failed = workerStatusRepository.findByIdAndTenantId(worker.getId(), tenantId).orElseThrow();
        assertAll(
                () -> assertEquals(WorkerRuntimeStatus.ERROR, failed.getStatus(),
                        "FAILOVER 后 Worker 状态应为 ERROR"),
                () -> assertTrue(failed.getIsolatedReason().contains("FAILOVER"),
                        "isolatedReason 应包含 FAILOVER 标记"),
                () -> assertNotNull(failed.getIsolatedAt())
        );
    }

    /**
     * 应该拒绝分发未知动作类型到 Worker
     */
    @Test
    @DisplayName("应该拒绝分发未知动作类型到 Worker")
    void shouldRejectUnknownActionForWorker() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-unknown-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-unknown-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // CANCEL 不支持 Worker 目标
        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.CANCEL,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "对 Worker 执行不支持的 CANCEL 动作",
                "step-up-token-cancel",
                true
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-011")),
                "Worker 不支持的 CANCEL 动作应抛 BusinessException");

        assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, ex.getErrorCode());

        // 验证审计记录状态为 FAILED（含 error_message）
        org.springframework.data.domain.Page<OperationsAction> failedActions =
                operationsActionRepository.findByTenantIdAndStatus(
                        tenantId, OperationsActionStatus.FAILED, org.springframework.data.domain.PageRequest.of(0, 10));
        assertFalse(failedActions.getContent().isEmpty(), "应至少有一条 FAILED 审计记录");
        OperationsAction failedAction = failedActions.getContent().get(0);
        assertEquals(OperationsActionStatus.FAILED, failedAction.getStatus(),
                "分发失败的动作状态应为 FAILED");
        assertNotNull(failedAction.getErrorMessage(),
                "FAILED 状态应记录 error_message");
    }

    /**
     * 应该拒绝无效 targetId（非 UUID 格式）
     */
    @Test
    @DisplayName("应该拒绝无效 targetId（非 UUID 格式）")
    void shouldRejectInvalidTargetId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-invalid-target-" + UUID.randomUUID());

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                "not-a-uuid",  // 非 UUID 格式
                "测试无效 targetId",
                "step-up-token-test",
                true
        );

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantId, request, buildHttpRequest("ops-user-012")),
                "无效 targetId 应抛 BusinessException");

        assertAll(
                () -> assertEquals(ErrorCode.PARAM_INVALID, ex.getErrorCode(),
                        "错误码应为 PARAM_INVALID"),
                () -> assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus()),
                () -> assertTrue(ex.getMessage().contains("targetId"),
                        "错误信息应包含 targetId")
        );
    }

    // ── 状态机流转 + 审计字段 ──

    /**
     * 应该持久化审计字段（operationId/auditTraceId/initiatedBy/initiatedAt）
     */
    @Test
    @DisplayName("应该持久化审计字段（operationId/auditTraceId/initiatedBy/initiatedAt）")
    void shouldPersistAuditFields() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-audit-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-audit-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "审计字段持久化测试",
                "step-up-token-audit",
                true
        );

        // Act（执行）
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, buildHttpRequest("audit-user@platform.com"));

        // Assert（断言）
        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(tenantId, response.operationId());
        assertTrue(saved.isPresent(), "审计记录应已持久化");
        assertAll(
                () -> assertEquals("audit-user@platform.com", saved.get().getInitiatedBy(),
                        "initiatedBy 应从 httpRequest x-user-id 头解析"),
                () -> assertNotNull(saved.get().getInitiatedAt(),
                        "initiatedAt 应已记录"),
                () -> assertNotNull(saved.get().getCompletedAt(),
                        "completedAt 应已记录"),
                () -> assertNotNull(saved.get().getAuditTraceId(),
                        "auditTraceId 应已生成"),
                () -> assertTrue(saved.get().getOperationId().startsWith("OPS-ACT-"),
                        "operationId 应以 OPS-ACT- 前缀"),
                () -> assertEquals(1, saved.get().getAffectedCount(),
                        "affectedCount 应为 1"),
                () -> assertNotNull(saved.get().getStepUpTokenHash(),
                        "stepUpTokenHash 应已持久化（不存储明文）"),
                () -> assertTrue(saved.get().getStepUpTokenHash().startsWith("v0hash:"),
                        "V0 占位哈希应以 v0hash: 前缀")
        );
    }

    /**
     * 应该在 httpRequest 为 null 时使用 system 作为 initiatedBy
     */
    @Test
    @DisplayName("应该在 httpRequest 为 null 时使用 system 作为 initiatedBy")
    void shouldUseSystemWhenHttpRequestIsNull() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-sys-" + UUID.randomUUID());
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                tenantId, "worker-sys-001", WorkerType.AI, WorkerRuntimeStatus.STOPPED));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.RESUME,
                OperationsActionTargetType.WORKER,
                worker.getId().toString(),
                "测试 httpRequest 为 null",
                null,
                false
        );

        // Act（执行）— 传入 null httpRequest
        OperationsActionResponseDto response = operationsActionService.executeAction(
                tenantId, request, null);

        // Assert（断言）
        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(tenantId, response.operationId());
        assertTrue(saved.isPresent());
        assertEquals("system", saved.get().getInitiatedBy(),
                "httpRequest 为 null 时 initiatedBy 应为 system");
    }

    // ── 跨租户隔离 ──

    /**
     * 应该强制租户隔离（A 租户不能操作 B 租户的 Worker）
     */
    @Test
    @DisplayName("应该强制租户隔离（A 租户不能操作 B 租户的 Worker）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-svc-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-svc-iso-b-" + UUID.randomUUID());
        WorkerStatus workerInA = workerStatusRepository.save(buildSampleWorker(
                tenantA, "worker-iso-001", WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        OperationsActionRequest request = new OperationsActionRequest(
                OperationsActionType.ISOLATE,
                OperationsActionTargetType.WORKER,
                workerInA.getId().toString(),
                "租户 B 试图操作租户 A 的 Worker",
                "step-up-token-iso",
                true
        );

        // Act（执行）— 租户 B 试图操作租户 A 的 Worker
        // 由于 WorkerService.isolateWorker 内部调用 findByIdAndTenantId 强制租户隔离，
        // 将抛出 NOT_FOUND 业务异常
        BusinessException ex = assertThrows(BusinessException.class,
                () -> operationsActionService.executeAction(tenantB, request, buildHttpRequest("tenant-b-user")),
                "租户 B 不应能操作租户 A 的 Worker");

        assertEquals(ErrorCode.NOT_FOUND, ex.getErrorCode(),
                "跨租户操作应返回 NOT_FOUND（不暴露资源存在性）");

        // 验证 Worker 未被隔离
        WorkerStatus unchanged = workerStatusRepository.findByIdAndTenantId(workerInA.getId(), tenantA).orElseThrow();
        assertFalse(unchanged.isIsolated(), "租户 A 的 Worker 不应被租户 B 隔离");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 WorkerStatus 实体
     */
    private WorkerStatus buildSampleWorker(
            UUID tenantId,
            String workerCode,
            WorkerType type,
            WorkerRuntimeStatus status) {
        WorkerStatus worker = new WorkerStatus();
        worker.setTenantId(tenantId);
        worker.setWorkerCode(workerCode);
        worker.setType(type);
        worker.setStatus(status);
        worker.setProcessedCount(100L);
        worker.setFailedCount(0L);
        worker.setAvgDurationSec(30);
        worker.setCpuPercent(new BigDecimal("45.50"));
        worker.setMemoryPercent(new BigDecimal("62.30"));
        worker.setLastHeartbeat(Instant.now());
        worker.setRegion("us-east-1");
        worker.setCustomerSiteWorker(false);
        worker.setIsolated(false);
        return worker;
    }

    /**
     * 构建示例 QueueTask 实体
     */
    private QueueTask buildSampleQueueTask(
            UUID tenantId,
            QueueTaskType type,
            QueueTaskStatus status,
            QueueTaskPriority priority) {
        QueueTask task = new QueueTask();
        task.setTenantId(tenantId);
        task.setType(type);
        task.setStatus(status);
        task.setPriority(priority);
        task.setPayload("测试任务负载");
        task.setQueuedAt(Instant.now());
        return task;
    }

    /**
     * 构建 retry storm 测试用的 FAILED OperationsAction
     */
    private OperationsAction buildFailedActionForRetryStorm(UUID tenantId, String targetId) {
        OperationsAction action = new OperationsAction();
        action.setTenantId(tenantId);
        action.setOperationId("OPS-ACT-STORM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        action.setActionType(OperationsActionType.RETRY);
        action.setTargetType(OperationsActionTargetType.QUEUE_TASK);
        action.setTargetId(targetId);
        action.setRiskLevel(OperationsRiskLevel.MEDIUM);
        action.setStatus(OperationsActionStatus.FAILED);
        action.setReason("retry storm 测试用：预置 FAILED 记录");
        action.setImpactPreviewAcknowledged(true);
        action.setInitiatedBy("storm-test@platform.com");
        action.setInitiatedAt(Instant.now());
        action.setCompletedAt(Instant.now());
        action.setAffectedCount(0);
        action.setAuditTraceId("trace-storm-" + UUID.randomUUID());
        action.setErrorMessage("OpenAI 429 Too Many Requests");
        return action;
    }

    /**
     * 构建 Mock HttpServletRequest（含 x-user-id 头）
     */
    private HttpServletRequest buildHttpRequest(String userId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-user-id", userId);
        return request;
    }
}
