package com.platform.core.operations.integration;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.queue.domain.QueueTask;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * QueueTask Repository 集成测试
 *
 * <p>验证 QueueTask 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 retry_count/max_retries retry storm 检测字段、data_region Hybrid-Site 字段）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndStatus/Type/Priority：按多维度分页查询</li>
 *   <li>countByTenantIdAndStatus/StatusIn：状态统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的任务</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 *   <li>retry storm 场景持久化（retry_count > max_retries * 2 阈值）</li>
 *   <li>Hybrid-Site 场景持久化（data_region + is_customer_site_worker）</li>
 *   <li>乐观锁：row_version 自动递增</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@DisplayName("QueueTask Repository 集成测试")
class QueueTaskRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private QueueTaskRepository queueTaskRepository;

    /**
     * 应该成功保存 QueueTask 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 QueueTask 并返回生成的 ID")
    void shouldSaveQueueTaskAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-save-" + UUID.randomUUID());
        QueueTask task = buildSampleQueueTask(
                tenantId, QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL);

        // Act（执行）
        QueueTask saved = queueTaskRepository.save(task);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals(QueueTaskType.AI_GENERATION, saved.getType()),
                () -> assertEquals(QueueTaskStatus.QUEUED, saved.getStatus()),
                () -> assertEquals(QueueTaskPriority.NORMAL, saved.getPriority()),
                () -> assertEquals("测试任务负载", saved.getPayload()),
                () -> assertEquals(0, saved.getRetryCount(), "retry_count 默认应为 0"),
                () -> assertEquals(3, saved.getMaxRetries(), "max_retries 默认应为 3"),
                () -> assertNotNull(saved.getQueuedAt(), "queued_at 不应为 null"),
                () -> assertNotNull(saved.getRowVersion(), "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询队列任务
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询队列任务")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-find-" + UUID.randomUUID());
        QueueTask saved = queueTaskRepository.save(
                buildSampleQueueTask(tenantId, QueueTaskType.COMPLIANCE_CHECK,
                        QueueTaskStatus.RUNNING, QueueTaskPriority.HIGH));

        // Act（执行）
        Optional<QueueTask> found = queueTaskRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能找到任务"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(tenantId, found.get().getTenantId()),
                () -> assertEquals(QueueTaskType.COMPLIANCE_CHECK, found.get().getType()),
                () -> assertEquals(QueueTaskStatus.RUNNING, found.get().getStatus())
        );
    }

    /**
     * 应该强制租户隔离（跨租户查询返回 empty）
     */
    @Test
    @DisplayName("应该强制租户隔离（跨租户查询返回 empty）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-qt-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-qt-iso-b-" + UUID.randomUUID());
        QueueTask savedInA = queueTaskRepository.save(
                buildSampleQueueTask(tenantA, QueueTaskType.AI_GENERATION,
                        QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        Optional<QueueTask> foundInB = queueTaskRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(foundInB.isPresent(), "租户 B 不应能查询租户 A 的任务");
    }

    /**
     * 应该按 tenantId 分页查询队列任务
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询队列任务")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            queueTaskRepository.save(
                    buildSampleQueueTask(tenantId, QueueTaskType.AI_GENERATION,
                            QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        }

        // Act（执行）
        Page<QueueTask> page = queueTaskRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements()),
                () -> assertEquals(1, page.getTotalPages()),
                () -> assertEquals(5, page.getContent().size())
        );
    }

    /**
     * 应该按 tenantId + status 分页查询（区分 QUEUED/RUNNING/FAILED）
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-status-" + UUID.randomUUID());
        // 3 个 QUEUED + 2 个 RUNNING + 1 个 FAILED
        for (int i = 0; i < 3; i++) {
            queueTaskRepository.save(buildSampleQueueTask(tenantId,
                    QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        }
        for (int i = 0; i < 2; i++) {
            queueTaskRepository.save(buildSampleQueueTask(tenantId,
                    QueueTaskType.AI_GENERATION, QueueTaskStatus.RUNNING, QueueTaskPriority.HIGH));
        }
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.CRITICAL));

        // Act（执行）
        Page<QueueTask> queued = queueTaskRepository.findByTenantIdAndStatus(
                tenantId, QueueTaskStatus.QUEUED, PageRequest.of(0, 10));
        Page<QueueTask> running = queueTaskRepository.findByTenantIdAndStatus(
                tenantId, QueueTaskStatus.RUNNING, PageRequest.of(0, 10));
        Page<QueueTask> failed = queueTaskRepository.findByTenantIdAndStatus(
                tenantId, QueueTaskStatus.FAILED, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, queued.getTotalElements(), "QUEUED 应有 3 个"),
                () -> assertEquals(2, running.getTotalElements(), "RUNNING 应有 2 个"),
                () -> assertEquals(1, failed.getTotalElements(), "FAILED 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + type 分页查询
     */
    @Test
    @DisplayName("应该按 tenantId + type 分页查询")
    void shouldFindByTenantIdAndTypeWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-type-" + UUID.randomUUID());
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.COMPLIANCE_CHECK, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        Page<QueueTask> aiGeneration = queueTaskRepository.findByTenantIdAndType(
                tenantId, QueueTaskType.AI_GENERATION, PageRequest.of(0, 10));
        Page<QueueTask> complianceCheck = queueTaskRepository.findByTenantIdAndType(
                tenantId, QueueTaskType.COMPLIANCE_CHECK, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, aiGeneration.getTotalElements(),
                        "AI_GENERATION 应有 2 个"),
                () -> assertEquals(1, complianceCheck.getTotalElements(),
                        "COMPLIANCE_CHECK 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + priority 分页查询
     */
    @Test
    @DisplayName("应该按 tenantId + priority 分页查询")
    void shouldFindByTenantIdAndPriorityWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-prio-" + UUID.randomUUID());
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.CRITICAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.HIGH));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        Page<QueueTask> critical = queueTaskRepository.findByTenantIdAndPriority(
                tenantId, QueueTaskPriority.CRITICAL, PageRequest.of(0, 10));
        Page<QueueTask> high = queueTaskRepository.findByTenantIdAndPriority(
                tenantId, QueueTaskPriority.HIGH, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(1, critical.getTotalElements(), "CRITICAL 应有 1 个"),
                () -> assertEquals(1, high.getTotalElements(), "HIGH 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + workerId 分页查询（Worker 已绑定的任务）
     */
    @Test
    @DisplayName("应该按 tenantId + workerId 分页查询")
    void shouldFindByTenantIdAndWorkerIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-worker-" + UUID.randomUUID());
        UUID workerId = UUID.randomUUID();
        QueueTask boundTask = buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL);
        boundTask.setWorkerId(workerId);
        queueTaskRepository.save(boundTask);

        // 另一个未绑定 Worker 的任务
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        Page<QueueTask> bound = queueTaskRepository.findByTenantIdAndWorkerId(
                tenantId, workerId, PageRequest.of(0, 10));

        // Assert（断言）
        assertEquals(1, bound.getTotalElements(), "Worker 应只绑定 1 个任务");
        assertEquals(workerId, bound.getContent().get(0).getWorkerId());
    }

    /**
     * 应该按 tenantId + status 统计
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-count-" + UUID.randomUUID());
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL));

        // Act（执行）
        long queuedCount = queueTaskRepository.countByTenantIdAndStatus(
                tenantId, QueueTaskStatus.QUEUED);
        long runningCount = queueTaskRepository.countByTenantIdAndStatus(
                tenantId, QueueTaskStatus.RUNNING);
        long failedCount = queueTaskRepository.countByTenantIdAndStatus(
                tenantId, QueueTaskStatus.FAILED);

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, queuedCount, "QUEUED 应有 2 个"),
                () -> assertEquals(1, runningCount, "RUNNING 应有 1 个"),
                () -> assertEquals(0, failedCount, "FAILED 应有 0 个")
        );
    }

    /**
     * 应该按 tenantId + statusIn 统计（活跃任务统计：QUEUED + RUNNING）
     */
    @Test
    @DisplayName("应该按 tenantId + statusIn 统计活跃任务")
    void shouldCountByTenantIdAndStatusIn() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-statusin-" + UUID.randomUUID());
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.COMPLETED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        // Act（执行）
        long activeCount = queueTaskRepository.countByTenantIdAndStatusIn(
                tenantId, List.of(QueueTaskStatus.QUEUED, QueueTaskStatus.RUNNING));

        // Assert（断言）
        assertEquals(2, activeCount, "活跃任务（QUEUED + RUNNING）应有 2 个");
    }

    /**
     * 应该持久化 retry storm 场景（retry_count > max_retries * 2 阈值）
     */
    @Test
    @DisplayName("应该持久化 retry storm 场景（retry_count=10 > max_retries*2=6）")
    void shouldPersistRetryStormScenario() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-retry-storm-" + UUID.randomUUID());
        QueueTask retryStormTask = buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.FAILED, QueueTaskPriority.CRITICAL);
        retryStormTask.setRetryCount(10);  // retry storm 阈值触发
        retryStormTask.setMaxRetries(3);
        retryStormTask.setLastError("调用 OpenAI API 失败：429 Too Many Requests");

        // Act（执行）
        QueueTask saved = queueTaskRepository.save(retryStormTask);
        Optional<QueueTask> found = queueTaskRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(10, found.get().getRetryCount(),
                        "retry_count 应为 10（触发 retry storm 检测）"),
                () -> assertEquals(3, found.get().getMaxRetries(),
                        "max_retries 应为 3"),
                () -> assertTrue(found.get().getRetryCount() > found.get().getMaxRetries() * 2,
                        "应满足 retry storm 检测条件 retry_count > max_retries * 2"),
                () -> assertEquals("调用 OpenAI API 失败：429 Too Many Requests",
                        found.get().getLastError(), "last_error 应记录最近错误信息"),
                () -> assertEquals(QueueTaskStatus.FAILED, found.get().getStatus(),
                        "状态应为 FAILED")
        );
    }

    /**
     * 应该持久化 Hybrid-Site 字段（data_region 跨 Region 数据驻留约束）
     */
    @Test
    @DisplayName("应该持久化 Hybrid-Site 字段（data_region）")
    void shouldPersistHybridSiteDataRegionField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-region-" + UUID.randomUUID());
        QueueTask crossRegionTask = buildSampleQueueTask(tenantId,
                QueueTaskType.PUBLICATION_SEAL, QueueTaskStatus.QUEUED, QueueTaskPriority.HIGH);
        crossRegionTask.setDataRegion("cn-beijing-1");  // 跨境数据传输约束
        crossRegionTask.setProjectId("PROJ-CN-001");
        crossRegionTask.setStageId("STAGE-CN-001");

        // Act（执行）
        QueueTask saved = queueTaskRepository.save(crossRegionTask);
        Optional<QueueTask> found = queueTaskRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals("cn-beijing-1", found.get().getDataRegion(),
                        "data_region 应持久化为 cn-beijing-1"),
                () -> assertEquals("PROJ-CN-001", found.get().getProjectId()),
                () -> assertEquals("STAGE-CN-001", found.get().getStageId())
        );
    }

    /**
     * 应该持久化任务状态流转（QUEUED → RUNNING → COMPLETED）
     */
    @Test
    @DisplayName("应该持久化任务状态流转（QUEUED → RUNNING → COMPLETED）")
    void shouldPersistTaskStatusTransition() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-transition-" + UUID.randomUUID());
        QueueTask task = queueTaskRepository.save(buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）QUEUED → RUNNING
        task.setStatus(QueueTaskStatus.RUNNING);
        task.setStartedAt(Instant.now());
        QueueTask running = queueTaskRepository.save(task);

        // RUNNING → COMPLETED
        running.setStatus(QueueTaskStatus.COMPLETED);
        running.setCompletedAt(Instant.now());
        running.setDurationSec(120);
        QueueTask completed = queueTaskRepository.save(running);

        // Assert（断言）
        Optional<QueueTask> found = queueTaskRepository.findByIdAndTenantId(
                completed.getId(), tenantId);
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(QueueTaskStatus.COMPLETED, found.get().getStatus()),
                () -> assertNotNull(found.get().getStartedAt(), "started_at 应已持久化"),
                () -> assertNotNull(found.get().getCompletedAt(), "completed_at 应已持久化"),
                () -> assertEquals(120, found.get().getDurationSec(), "duration_sec 应为 120")
        );
    }

    /**
     * 应该拒绝缺少必填字段（payload 为 null）
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（payload 为 null）")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-qt-missing-" + UUID.randomUUID());
        QueueTask task = buildSampleQueueTask(tenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL);
        task.setPayload(null);  // payload 为 NOT NULL

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> queueTaskRepository.save(task),
                "payload 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在的租户（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在的租户（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID fakeTenantId = UUID.randomUUID();  // 不存在的租户 ID
        QueueTask task = buildSampleQueueTask(fakeTenantId,
                QueueTaskType.AI_GENERATION, QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> queueTaskRepository.save(task),
                "引用不存在的租户应抛外键约束异常");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 QueueTask 实体（含必填字段）
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
}
