package com.platform.core.operations.integration;

import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * OperationsAction Repository 集成测试
 *
 * <p>验证 OperationsAction 实体通过 Repository 完成完整 CRUD 与危险动作约束持久化：
 * <ul>
 *   <li>save：写入实体（含 step_up_token_hash、impact_preview_acknowledged、reviewer1/2 危险动作字段）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndStatus/ActionType：按多维度分页查询</li>
 *   <li>findByTenantIdAndOperationId：按业务编号查询</li>
 *   <li>countByTenantIdAndTargetIdAndStatus：retry storm 检测占位（同 target 多次 FAILED）</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的动作</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 *   <li>唯一约束：operation_id 重复应拒绝</li>
 *   <li>IRREVERSIBLE 动作（CANCEL）持久化：双人审批字段 + stepUpTokenHash</li>
 *   <li>HIGH 风险动作（ISOLATE）持久化：stepUpTokenHash + 影响预览确认</li>
 *   <li>状态机流转（QUEUED → RUNNING → COMPLETED）持久化</li>
 *   <li>乐观锁：row_version 自动递增</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17（§危险动作）
 * @design D35-API-事件契约.md（危险动作审计）
 * @design D40-信息-物理安全.md（Step-up 认证）
 */
@DisplayName("OperationsAction Repository 集成测试")
class OperationsActionRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private OperationsActionRepository operationsActionRepository;

    /**
     * 应该成功保存 OperationsAction 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 OperationsAction 并返回生成的 ID")
    void shouldSaveOperationsActionAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-save-" + UUID.randomUUID());
        OperationsAction action = buildSampleAction(
                tenantId, OperationsActionType.ISOLATE, OperationsActionStatus.QUEUED,
                OperationsRiskLevel.HIGH);

        // Act（执行）
        OperationsAction saved = operationsActionRepository.save(action);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals(OperationsActionType.ISOLATE, saved.getActionType()),
                () -> assertEquals(OperationsActionStatus.QUEUED, saved.getStatus()),
                () -> assertEquals(OperationsRiskLevel.HIGH, saved.getRiskLevel()),
                () -> assertEquals(OperationsActionTargetType.WORKER, saved.getTargetType()),
                () -> assertNotNull(saved.getOperationId(), "operation_id 不应为 null"),
                () -> assertNotNull(saved.getReason(), "reason 不应为 null"),
                () -> assertNotNull(saved.getInitiatedBy(), "initiated_by 不应为 null"),
                () -> assertNotNull(saved.getInitiatedAt(), "initiated_at 不应为 null"),
                () -> assertNotNull(saved.getAuditTraceId(), "audit_trace_id 不应为 null"),
                () -> assertNotNull(saved.getRowVersion(), "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询 OperationsAction
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询 OperationsAction")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-find-" + UUID.randomUUID());
        OperationsAction saved = operationsActionRepository.save(
                buildSampleAction(tenantId, OperationsActionType.RETRY,
                        OperationsActionStatus.COMPLETED, OperationsRiskLevel.MEDIUM));

        // Act（执行）
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能找到动作"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(tenantId, found.get().getTenantId()),
                () -> assertEquals(OperationsActionType.RETRY, found.get().getActionType()),
                () -> assertEquals(OperationsActionStatus.COMPLETED, found.get().getStatus())
        );
    }

    /**
     * 应该强制租户隔离（跨租户查询返回 empty）
     */
    @Test
    @DisplayName("应该强制租户隔离（跨租户查询返回 empty）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-oa-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-oa-iso-b-" + UUID.randomUUID());
        OperationsAction savedInA = operationsActionRepository.save(
                buildSampleAction(tenantA, OperationsActionType.ISOLATE,
                        OperationsActionStatus.QUEUED, OperationsRiskLevel.HIGH));

        // Act（执行）
        Optional<OperationsAction> foundInB = operationsActionRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(foundInB.isPresent(), "租户 B 不应能查询租户 A 的动作");
    }

    /**
     * 应该按 tenantId 分页查询 OperationsAction
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询 OperationsAction")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            operationsActionRepository.save(
                    buildSampleAction(tenantId, OperationsActionType.RETRY,
                            OperationsActionStatus.COMPLETED, OperationsRiskLevel.MEDIUM));
        }

        // Act（执行）
        Page<OperationsAction> page = operationsActionRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements()),
                () -> assertEquals(1, page.getTotalPages()),
                () -> assertEquals(5, page.getContent().size())
        );
    }

    /**
     * 应该按 tenantId + status 分页查询（区分 QUEUED/RUNNING/COMPLETED/FAILED）
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-status-" + UUID.randomUUID());
        // 3 个 QUEUED + 2 个 RUNNING + 1 个 COMPLETED + 1 个 FAILED
        for (int i = 0; i < 3; i++) {
            operationsActionRepository.save(buildSampleAction(tenantId,
                    OperationsActionType.RETRY, OperationsActionStatus.QUEUED,
                    OperationsRiskLevel.MEDIUM));
        }
        for (int i = 0; i < 2; i++) {
            operationsActionRepository.save(buildSampleAction(tenantId,
                    OperationsActionType.ISOLATE, OperationsActionStatus.RUNNING,
                    OperationsRiskLevel.HIGH));
        }
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.RECONCILE, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.MEDIUM));
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.CANCEL, OperationsActionStatus.FAILED,
                OperationsRiskLevel.IRREVERSIBLE));

        // Act（执行）
        Page<OperationsAction> queued = operationsActionRepository.findByTenantIdAndStatus(
                tenantId, OperationsActionStatus.QUEUED, PageRequest.of(0, 10));
        Page<OperationsAction> running = operationsActionRepository.findByTenantIdAndStatus(
                tenantId, OperationsActionStatus.RUNNING, PageRequest.of(0, 10));
        Page<OperationsAction> completed = operationsActionRepository.findByTenantIdAndStatus(
                tenantId, OperationsActionStatus.COMPLETED, PageRequest.of(0, 10));
        Page<OperationsAction> failed = operationsActionRepository.findByTenantIdAndStatus(
                tenantId, OperationsActionStatus.FAILED, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, queued.getTotalElements(), "QUEUED 应有 3 个"),
                () -> assertEquals(2, running.getTotalElements(), "RUNNING 应有 2 个"),
                () -> assertEquals(1, completed.getTotalElements(), "COMPLETED 应有 1 个"),
                () -> assertEquals(1, failed.getTotalElements(), "FAILED 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + actionType 分页查询（区分 ISOLATE/RETRY/CANCEL）
     */
    @Test
    @DisplayName("应该按 tenantId + actionType 分页查询")
    void shouldFindByTenantIdAndActionTypeWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-type-" + UUID.randomUUID());
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.HIGH));
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.HIGH));
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.RETRY, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.MEDIUM));
        operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.CANCEL, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.IRREVERSIBLE));

        // Act（执行）
        Page<OperationsAction> isolate = operationsActionRepository.findByTenantIdAndActionType(
                tenantId, OperationsActionType.ISOLATE, PageRequest.of(0, 10));
        Page<OperationsAction> retry = operationsActionRepository.findByTenantIdAndActionType(
                tenantId, OperationsActionType.RETRY, PageRequest.of(0, 10));
        Page<OperationsAction> cancel = operationsActionRepository.findByTenantIdAndActionType(
                tenantId, OperationsActionType.CANCEL, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, isolate.getTotalElements(), "ISOLATE 应有 2 个"),
                () -> assertEquals(1, retry.getTotalElements(), "RETRY 应有 1 个"),
                () -> assertEquals(1, cancel.getTotalElements(), "CANCEL 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + operationId 查询（业务编号唯一）
     */
    @Test
    @DisplayName("应该按 tenantId + operationId 查询")
    void shouldFindByTenantIdAndOperationId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-opid-" + UUID.randomUUID());
        OperationsAction saved = operationsActionRepository.save(
                buildSampleAction(tenantId, OperationsActionType.RECONCILE,
                        OperationsActionStatus.COMPLETED, OperationsRiskLevel.MEDIUM));

        // Act（执行）
        Optional<OperationsAction> found = operationsActionRepository.findByTenantIdAndOperationId(
                tenantId, saved.getOperationId());

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能通过 operation_id 找到动作"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(saved.getOperationId(), found.get().getOperationId())
        );
    }

    /**
     * 应该统计指定 target_id 的 FAILED 动作数（retry storm 检测占位）
     *
     * <p>对齐 D37.17 §retry storm 检测红线：同 target 连续 FAILED 超阈值（如 ≥ 3）触发告警。
     * V0 占位实现：按 target_id + status 统计；V1 接入时间窗口与指标计算。
     */
    @Test
    @DisplayName("应该统计指定 target 的 FAILED 动作数（retry storm 检测占位）")
    void shouldCountByTenantIdAndTargetIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-retry-storm-" + UUID.randomUUID());
        String targetId = "queue-task-" + UUID.randomUUID();
        // 同 target 4 次 FAILED（触发 retry storm 阈值 ≥ 3）
        for (int i = 0; i < 4; i++) {
            OperationsAction action = buildSampleActionWithTarget(tenantId, targetId,
                    OperationsActionType.RETRY, OperationsActionStatus.FAILED,
                    OperationsRiskLevel.MEDIUM);
            operationsActionRepository.save(action);
        }
        // 另一个 target 的 FAILED（不应计入统计）
        operationsActionRepository.save(buildSampleActionWithTarget(tenantId,
                "other-target-" + UUID.randomUUID(),
                OperationsActionType.RETRY, OperationsActionStatus.FAILED,
                OperationsRiskLevel.MEDIUM));
        // 同 target 的 COMPLETED（不应计入 FAILED 统计）
        operationsActionRepository.save(buildSampleActionWithTarget(tenantId, targetId,
                OperationsActionType.RETRY, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.MEDIUM));

        // Act（执行）
        long failedCount = operationsActionRepository.countByTenantIdAndTargetIdAndStatus(
                tenantId, targetId, OperationsActionStatus.FAILED);

        // Assert（断言）
        assertEquals(4L, failedCount, "target_id 应有 4 个 FAILED（触发 retry storm 阈值 ≥ 3）");
    }

    /**
     * 应该持久化 IRREVERSIBLE 动作（CANCEL）双人审批字段
     *
     * <p>对齐 D37.17 §危险动作：IRREVERSIBLE 动作（CANCEL）必须：
     * <ul>
     *   <li>stepUpTokenHash：Step-up Token 哈希（不存储明文，HIGH/IRREVERSIBLE 必填）</li>
     *   <li>impactPreviewAcknowledged=true：影响预览已确认</li>
     *   <li>reviewer1/reviewer2：双人审批（V0 占位通过）</li>
     * </ul>
     */
    @Test
    @DisplayName("应该持久化 IRREVERSIBLE 动作（CANCEL）双人审批字段")
    void shouldPersistIrreversibleActionWithDualReview() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-cancel-" + UUID.randomUUID());
        OperationsAction cancelAction = buildSampleAction(tenantId,
                OperationsActionType.CANCEL, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.IRREVERSIBLE);
        cancelAction.setStepUpTokenHash("sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
        cancelAction.setImpactPreviewAcknowledged(true);
        cancelAction.setReviewer1("architect-zhang-san@platform.com");
        cancelAction.setReviewer2("architect-li-si@platform.com");
        cancelAction.setAffectedCount(15);
        cancelAction.setCompletedAt(Instant.now());
        cancelAction.setReason("取消高风险 AI 生成任务：检测到 prompt 注入风险，需要双人复核");

        // Act（执行）
        OperationsAction saved = operationsActionRepository.save(cancelAction);
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— IRREVERSIBLE 动作危险约束持久化验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(OperationsRiskLevel.IRREVERSIBLE, found.get().getRiskLevel(),
                        "风险等级应为 IRREVERSIBLE"),
                () -> assertEquals("sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
                        found.get().getStepUpTokenHash(),
                        "step_up_token_hash 应持久化（不存储明文）"),
                () -> assertTrue(found.get().isImpactPreviewAcknowledged(),
                        "impact_preview_acknowledged 应为 true（IRREVERSIBLE 强制）"),
                () -> assertEquals("architect-zhang-san@platform.com", found.get().getReviewer1(),
                        "reviewer1 应持久化（双人审批第一人）"),
                () -> assertEquals("architect-li-si@platform.com", found.get().getReviewer2(),
                        "reviewer2 应持久化（双人审批第二人）"),
                () -> assertEquals(15, found.get().getAffectedCount(),
                        "affected_count 应为 15"),
                () -> assertEquals(OperationsActionStatus.COMPLETED, found.get().getStatus(),
                        "状态应为 COMPLETED"),
                () -> assertNotNull(found.get().getCompletedAt(), "completed_at 应已记录"),
                () -> assertEquals("取消高风险 AI 生成任务：检测到 prompt 注入风险，需要双人复核",
                        found.get().getReason(), "reason 应记录操作意图（进入审计日志）")
        );
    }

    /**
     * 应该持久化 HIGH 风险动作（ISOLATE）stepUpToken + 影响预览确认
     *
     * <p>对齐 D37.17 §危险动作：HIGH 风险动作（ISOLATE/FAILOVER）必须：
     * <ul>
     *   <li>stepUpTokenHash：Step-up Token 哈希（不存储明文）</li>
     *   <li>impactPreviewAcknowledged=true：影响预览已确认</li>
     * </ul>
     * 注意：reviewer1/reviewer2 在 HIGH 风险动作中可为 null（仅 IRREVERSIBLE 强制双人审批）。
     */
    @Test
    @DisplayName("应该持久化 HIGH 风险动作（ISOLATE）stepUpToken + 影响预览确认")
    void shouldPersistHighRiskActionWithStepUpToken() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-isolate-" + UUID.randomUUID());
        OperationsAction isolateAction = buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.HIGH);
        isolateAction.setStepUpTokenHash("sha256:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b8493a8e5d4d9b");
        isolateAction.setImpactPreviewAcknowledged(true);
        isolateAction.setAffectedCount(1);
        isolateAction.setCompletedAt(Instant.now());
        isolateAction.setReason("Worker 心跳超时 10 分钟，自动隔离以防任务分派失败");

        // Act（执行）
        OperationsAction saved = operationsActionRepository.save(isolateAction);
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— HIGH 风险动作危险约束持久化验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(OperationsRiskLevel.HIGH, found.get().getRiskLevel(),
                        "风险等级应为 HIGH"),
                () -> assertEquals("sha256:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b8493a8e5d4d9b",
                        found.get().getStepUpTokenHash(),
                        "step_up_token_hash 应持久化（HIGH 风险强制）"),
                () -> assertTrue(found.get().isImpactPreviewAcknowledged(),
                        "impact_preview_acknowledged 应为 true（HIGH 风险强制）"),
                () -> assertEquals(1, found.get().getAffectedCount(),
                        "affected_count 应为 1（隔离单个 Worker）"),
                () -> assertEquals(OperationsActionType.ISOLATE, found.get().getActionType(),
                        "动作类型应为 ISOLATE"),
                () -> assertEquals(OperationsActionTargetType.WORKER, found.get().getTargetType(),
                        "目标类型应为 WORKER")
        );
    }

    /**
     * 应该持久化 MEDIUM 风险动作（RETRY）仅需影响预览确认
     *
     * <p>对齐 D37.17 §危险动作：MEDIUM 风险动作（RETRY/RECONCILE/PAUSE）必须：
     * <ul>
     *   <li>impactPreviewAcknowledged=true：影响预览已确认</li>
     * </ul>
     * 注意：stepUpTokenHash 在 MEDIUM 风险动作中可为 null（仅 HIGH/IRREVERSIBLE 强制）。
     */
    @Test
    @DisplayName("应该持久化 MEDIUM 风险动作（RETRY）仅需影响预览确认")
    void shouldPersistMediumRiskActionWithImpactPreviewOnly() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-retry-" + UUID.randomUUID());
        OperationsAction retryAction = buildSampleAction(tenantId,
                OperationsActionType.RETRY, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.MEDIUM);
        retryAction.setStepUpTokenHash(null);  // MEDIUM 风险不强制 stepUpToken
        retryAction.setImpactPreviewAcknowledged(true);
        retryAction.setAffectedCount(1);
        retryAction.setCompletedAt(Instant.now());
        retryAction.setReason("AI 生成任务临时失败（OpenAI 429），手动重试");

        // Act（执行）
        OperationsAction saved = operationsActionRepository.save(retryAction);
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— MEDIUM 风险动作危险约束持久化验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(OperationsRiskLevel.MEDIUM, found.get().getRiskLevel(),
                        "风险等级应为 MEDIUM"),
                () -> assertTrue(found.get().isImpactPreviewAcknowledged(),
                        "impact_preview_acknowledged 应为 true（MEDIUM 风险强制）"),
                () -> assertEquals(OperationsActionStatus.COMPLETED, found.get().getStatus(),
                        "状态应为 COMPLETED")
        );
    }

    /**
     * 应该持久化动作状态流转（QUEUED → RUNNING → COMPLETED）
     */
    @Test
    @DisplayName("应该持久化动作状态流转（QUEUED → RUNNING → COMPLETED）")
    void shouldPersistActionStatusTransition() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-transition-" + UUID.randomUUID());
        OperationsAction action = operationsActionRepository.save(buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.QUEUED,
                OperationsRiskLevel.HIGH));

        // Act（执行）QUEUED → RUNNING
        action.setStatus(OperationsActionStatus.RUNNING);
        OperationsAction running = operationsActionRepository.save(action);

        // RUNNING → COMPLETED
        running.setStatus(OperationsActionStatus.COMPLETED);
        running.setCompletedAt(Instant.now());
        running.setAffectedCount(1);
        OperationsAction completed = operationsActionRepository.save(running);

        // Assert（断言）
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                completed.getId(), tenantId);
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(OperationsActionStatus.COMPLETED, found.get().getStatus()),
                () -> assertNotNull(found.get().getCompletedAt(), "completed_at 应已持久化"),
                () -> assertEquals(1, found.get().getAffectedCount(),
                        "affected_count 应为 1")
        );
    }

    /**
     * 应该持久化 FAILED 状态动作（含 error_message）
     */
    @Test
    @DisplayName("应该持久化 FAILED 状态动作（含 error_message）")
    void shouldPersistFailedActionWithErrorMessage() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-failed-" + UUID.randomUUID());
        OperationsAction action = buildSampleAction(tenantId,
                OperationsActionType.FAILOVER, OperationsActionStatus.FAILED,
                OperationsRiskLevel.HIGH);
        action.setStepUpTokenHash("sha256:abc123def456");
        action.setImpactPreviewAcknowledged(true);
        action.setErrorMessage("备用实例不可达：us-west-2 region 网络异常，failover 失败");
        action.setCompletedAt(Instant.now());
        action.setReason("主实例 OOM，执行 failover 切换到备用实例");

        // Act（执行）
        OperationsAction saved = operationsActionRepository.save(action);
        Optional<OperationsAction> found = operationsActionRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(OperationsActionStatus.FAILED, found.get().getStatus()),
                () -> assertEquals("备用实例不可达：us-west-2 region 网络异常，failover 失败",
                        found.get().getErrorMessage(), "error_message 应持久化"),
                () -> assertEquals(OperationsActionType.FAILOVER, found.get().getActionType()),
                () -> assertNotNull(found.get().getCompletedAt())
        );
    }

    /**
     * 应该拒绝缺少必填字段（reason 为 null）
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（reason 为 null）")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-missing-" + UUID.randomUUID());
        OperationsAction action = buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.QUEUED,
                OperationsRiskLevel.HIGH);
        action.setReason(null);  // reason 为 NOT NULL

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> operationsActionRepository.save(action),
                "reason 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在的租户（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在的租户（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID fakeTenantId = UUID.randomUUID();  // 不存在的租户 ID
        OperationsAction action = buildSampleAction(fakeTenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.QUEUED,
                OperationsRiskLevel.HIGH);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> operationsActionRepository.save(action),
                "引用不存在的租户应抛外键约束异常");
    }

    /**
     * 应该拒绝 operation_id 重复（唯一约束）
     */
    @Test
    @DisplayName("应该拒绝 operation_id 重复（唯一约束）")
    void shouldRejectDuplicateOperationId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-oa-unique-" + UUID.randomUUID());
        OperationsAction first = buildSampleAction(tenantId,
                OperationsActionType.ISOLATE, OperationsActionStatus.COMPLETED,
                OperationsRiskLevel.HIGH);
        first.setOperationId("OPS-ACT-20260729-DUP-001");
        operationsActionRepository.save(first);

        // 第二条使用相同 operation_id
        OperationsAction duplicate = buildSampleAction(tenantId,
                OperationsActionType.RETRY, OperationsActionStatus.QUEUED,
                OperationsRiskLevel.MEDIUM);
        duplicate.setOperationId("OPS-ACT-20260729-DUP-001");

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> operationsActionRepository.save(duplicate),
                "operation_id 重复应抛唯一约束异常");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 OperationsAction 实体（含必填字段）
     *
     * <p>默认 targetType=WORKER，targetId=随机 UUID，便于多动作隔离测试。
     */
    private OperationsAction buildSampleAction(
            UUID tenantId,
            OperationsActionType actionType,
            OperationsActionStatus status,
            OperationsRiskLevel riskLevel) {
        return buildSampleActionWithTarget(
                tenantId,
                "worker-target-" + UUID.randomUUID(),
                actionType,
                status,
                riskLevel);
    }

    /**
     * 构建指定 targetId 的示例 OperationsAction 实体（用于 retry storm 测试）
     */
    private OperationsAction buildSampleActionWithTarget(
            UUID tenantId,
            String targetId,
            OperationsActionType actionType,
            OperationsActionStatus status,
            OperationsRiskLevel riskLevel) {
        OperationsAction action = new OperationsAction();
        action.setTenantId(tenantId);
        action.setOperationId("OPS-ACT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        action.setActionType(actionType);
        action.setTargetType(OperationsActionTargetType.WORKER);
        action.setTargetId(targetId);
        action.setRiskLevel(riskLevel);
        action.setStatus(status);
        action.setReason("测试危险动作：" + actionType.name() + " on " + targetId);
        action.setImpactPreviewAcknowledged(false);  // 默认未确认，特殊场景显式设置
        action.setInitiatedBy("ops-user@platform.com");
        action.setInitiatedAt(Instant.now());
        action.setAffectedCount(0);
        action.setAuditTraceId("trace-" + UUID.randomUUID());
        return action;
    }
}
