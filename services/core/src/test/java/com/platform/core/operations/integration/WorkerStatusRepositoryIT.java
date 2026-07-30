package com.platform.core.operations.integration;

import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.domain.WorkerStatus;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
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
 * WorkerStatus Repository 集成测试
 *
 * <p>验证 WorkerStatus 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 Hybrid-Site 字段 region/isCustomerSiteWorker、隔离字段 isIsolated/isolatedReason/isolatedAt）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndType：按 Worker 类型分页查询（AI/RULE/ANALYSIS/INGEST/PUBLICATION）</li>
 *   <li>findByTenantIdAndStatus：按运行状态分页查询（RUNNING/IDLE/STOPPED/ERROR）</li>
 *   <li>findByTenantIdAndRegion：按 Region 分页查询（Hybrid-Site 部署）</li>
 *   <li>findByTenantIdAndWorkerCode：按 workerCode 查询（唯一约束）</li>
 *   <li>countByTenantIdAndStatus：状态统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的 Worker</li>
 *   <li>Hybrid-Site 字段持久化（region + isCustomerSiteWorker，对齐 OD-06）</li>
 *   <li>隔离 Worker 持久化（ISOLATE 动作执行后 isIsolated=true + isolatedReason + isolatedAt）</li>
 *   <li>worker_code 唯一约束（uq_worker_status_code）</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@DisplayName("WorkerStatus Repository 集成测试")
class WorkerStatusRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private WorkerStatusRepository workerStatusRepository;

    /**
     * 应该成功保存 WorkerStatus 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 WorkerStatus 并返回生成的 ID")
    void shouldSaveWorkerStatusAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-save-" + UUID.randomUUID());
        WorkerStatus worker = buildSampleWorker(tenantId, "ai-worker-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);

        // Act（执行）
        WorkerStatus saved = workerStatusRepository.save(worker);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals("ai-worker-001", saved.getWorkerCode()),
                () -> assertEquals(WorkerType.AI, saved.getType()),
                () -> assertEquals(WorkerRuntimeStatus.RUNNING, saved.getStatus()),
                () -> assertEquals(0, new BigDecimal("45.50").compareTo(saved.getCpuPercent()),
                        "cpuPercent 应为 45.50"),
                () -> assertEquals(0, new BigDecimal("62.30").compareTo(saved.getMemoryPercent()),
                        "memoryPercent 应为 62.30"),
                () -> assertNotNull(saved.getLastHeartbeat(), "lastHeartbeat 不应为 null"),
                () -> assertFalse(saved.isCustomerSiteWorker(),
                        "is_customer_site_worker 默认应为 false"),
                () -> assertFalse(saved.isIsolated(),
                        "is_isolated 默认应为 false"),
                () -> assertNotNull(saved.getRowVersion(), "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询 Worker
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询 Worker")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-find-" + UUID.randomUUID());
        WorkerStatus saved = workerStatusRepository.save(
                buildSampleWorker(tenantId, "rule-worker-001",
                        WorkerType.RULE, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        Optional<WorkerStatus> found = workerStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能找到 Worker"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(tenantId, found.get().getTenantId()),
                () -> assertEquals("rule-worker-001", found.get().getWorkerCode()),
                () -> assertEquals(WorkerType.RULE, found.get().getType()),
                () -> assertEquals(WorkerRuntimeStatus.IDLE, found.get().getStatus())
        );
    }

    /**
     * 应该强制租户隔离（跨租户查询返回 empty）
     */
    @Test
    @DisplayName("应该强制租户隔离（跨租户查询返回 empty）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-ws-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-ws-iso-b-" + UUID.randomUUID());
        WorkerStatus savedInA = workerStatusRepository.save(
                buildSampleWorker(tenantA, "ai-worker-001",
                        WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // Act（执行）
        Optional<WorkerStatus> foundInB = workerStatusRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(foundInB.isPresent(), "租户 B 不应能查询租户 A 的 Worker");
    }

    /**
     * 应该按 tenantId 分页查询 Worker 列表
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询 Worker 列表")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            workerStatusRepository.save(buildSampleWorker(tenantId, "ai-worker-" + i,
                    WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        }

        // Act（执行）
        Page<WorkerStatus> page = workerStatusRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements()),
                () -> assertEquals(1, page.getTotalPages()),
                () -> assertEquals(5, page.getContent().size())
        );
    }

    /**
     * 应该按 tenantId + type 分页查询（区分 AI/RULE/ANALYSIS/INGEST/PUBLICATION）
     */
    @Test
    @DisplayName("应该按 tenantId + type 分页查询")
    void shouldFindByTenantIdAndTypeWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-type-" + UUID.randomUUID());
        workerStatusRepository.save(buildSampleWorker(tenantId, "ai-1",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        workerStatusRepository.save(buildSampleWorker(tenantId, "ai-2",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));
        workerStatusRepository.save(buildSampleWorker(tenantId, "rule-1",
                WorkerType.RULE, WorkerRuntimeStatus.RUNNING));
        workerStatusRepository.save(buildSampleWorker(tenantId, "pub-1",
                WorkerType.PUBLICATION, WorkerRuntimeStatus.STOPPED));

        // Act（执行）
        Page<WorkerStatus> aiWorkers = workerStatusRepository.findByTenantIdAndType(
                tenantId, WorkerType.AI, PageRequest.of(0, 10));
        Page<WorkerStatus> ruleWorkers = workerStatusRepository.findByTenantIdAndType(
                tenantId, WorkerType.RULE, PageRequest.of(0, 10));
        Page<WorkerStatus> publicationWorkers = workerStatusRepository.findByTenantIdAndType(
                tenantId, WorkerType.PUBLICATION, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, aiWorkers.getTotalElements(), "AI Worker 应有 2 个"),
                () -> assertEquals(1, ruleWorkers.getTotalElements(), "RULE Worker 应有 1 个"),
                () -> assertEquals(1, publicationWorkers.getTotalElements(),
                        "PUBLICATION Worker 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + status 分页查询（区分 RUNNING/IDLE/STOPPED/ERROR）
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-status-" + UUID.randomUUID());
        // 3 个 RUNNING + 2 个 IDLE + 1 个 STOPPED + 1 个 ERROR
        for (int i = 0; i < 3; i++) {
            workerStatusRepository.save(buildSampleWorker(tenantId, "run-" + i,
                    WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        }
        for (int i = 0; i < 2; i++) {
            workerStatusRepository.save(buildSampleWorker(tenantId, "idle-" + i,
                    WorkerType.AI, WorkerRuntimeStatus.IDLE));
        }
        workerStatusRepository.save(buildSampleWorker(tenantId, "stopped-1",
                WorkerType.AI, WorkerRuntimeStatus.STOPPED));
        workerStatusRepository.save(buildSampleWorker(tenantId, "error-1",
                WorkerType.AI, WorkerRuntimeStatus.ERROR));

        // Act（执行）
        Page<WorkerStatus> running = workerStatusRepository.findByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.RUNNING, PageRequest.of(0, 10));
        Page<WorkerStatus> idle = workerStatusRepository.findByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.IDLE, PageRequest.of(0, 10));
        Page<WorkerStatus> stopped = workerStatusRepository.findByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.STOPPED, PageRequest.of(0, 10));
        Page<WorkerStatus> error = workerStatusRepository.findByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.ERROR, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, running.getTotalElements(), "RUNNING 应有 3 个"),
                () -> assertEquals(2, idle.getTotalElements(), "IDLE 应有 2 个"),
                () -> assertEquals(1, stopped.getTotalElements(), "STOPPED 应有 1 个"),
                () -> assertEquals(1, error.getTotalElements(), "ERROR 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + region 分页查询（Hybrid-Site 部署）
     */
    @Test
    @DisplayName("应该按 tenantId + region 分页查询（Hybrid-Site）")
    void shouldFindByTenantIdAndRegionWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-region-" + UUID.randomUUID());
        WorkerStatus beijingWorker = buildSampleWorker(tenantId, "ai-bj-1",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);
        beijingWorker.setRegion("cn-beijing-1");
        beijingWorker.setCustomerSiteWorker(true);
        workerStatusRepository.save(beijingWorker);

        WorkerStatus usWorker = buildSampleWorker(tenantId, "ai-us-1",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);
        usWorker.setRegion("us-west-2");
        workerStatusRepository.save(usWorker);

        // Act（执行）
        Page<WorkerStatus> beijing = workerStatusRepository.findByTenantIdAndRegion(
                tenantId, "cn-beijing-1", PageRequest.of(0, 10));
        Page<WorkerStatus> us = workerStatusRepository.findByTenantIdAndRegion(
                tenantId, "us-west-2", PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(1, beijing.getTotalElements(),
                        "cn-beijing-1 Region 应有 1 个 Worker"),
                () -> assertEquals("cn-beijing-1", beijing.getContent().get(0).getRegion()),
                () -> assertTrue(beijing.getContent().get(0).isCustomerSiteWorker(),
                        "北京 Worker 应为客户站点 Worker"),
                () -> assertEquals(1, us.getTotalElements(),
                        "us-west-2 Region 应有 1 个 Worker"),
                () -> assertEquals("us-west-2", us.getContent().get(0).getRegion())
        );
    }

    /**
     * 应该按 tenantId + workerCode 查询（唯一约束）
     */
    @Test
    @DisplayName("应该按 tenantId + workerCode 查询")
    void shouldFindByTenantIdAndWorkerCode() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-code-" + UUID.randomUUID());
        workerStatusRepository.save(buildSampleWorker(tenantId, "ai-worker-special-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // Act（执行）
        Optional<WorkerStatus> found = workerStatusRepository.findByTenantIdAndWorkerCode(
                tenantId, "ai-worker-special-001");

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应按 workerCode 查询到 Worker"),
                () -> assertEquals("ai-worker-special-001", found.get().getWorkerCode())
        );
    }

    /**
     * 应该按 tenantId + status 统计
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-count-" + UUID.randomUUID());
        workerStatusRepository.save(buildSampleWorker(tenantId, "run-1",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        workerStatusRepository.save(buildSampleWorker(tenantId, "run-2",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        workerStatusRepository.save(buildSampleWorker(tenantId, "idle-1",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));
        workerStatusRepository.save(buildSampleWorker(tenantId, "error-1",
                WorkerType.AI, WorkerRuntimeStatus.ERROR));

        // Act（执行）
        long runningCount = workerStatusRepository.countByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.RUNNING);
        long idleCount = workerStatusRepository.countByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.IDLE);
        long errorCount = workerStatusRepository.countByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.ERROR);
        long stoppedCount = workerStatusRepository.countByTenantIdAndStatus(
                tenantId, WorkerRuntimeStatus.STOPPED);

        // Assert（断言）
        assertAll(
                () -> assertEquals(2L, runningCount, "RUNNING 应有 2 个"),
                () -> assertEquals(1L, idleCount, "IDLE 应有 1 个"),
                () -> assertEquals(1L, errorCount, "ERROR 应有 1 个"),
                () -> assertEquals(0L, stoppedCount, "STOPPED 应有 0 个")
        );
    }

    /**
     * 应该持久化 Hybrid-Site 客户站点 Worker（region + isCustomerSiteWorker）
     */
    @Test
    @DisplayName("应该持久化 Hybrid-Site 客户站点 Worker（region=cn-beijing-1 + isCustomerSiteWorker=true）")
    void shouldPersistHybridSiteCustomerSiteWorker() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-csw-" + UUID.randomUUID());
        WorkerStatus customerSiteWorker = buildSampleWorker(tenantId, "ai-cs-bj-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);
        customerSiteWorker.setRegion("cn-beijing-1");
        customerSiteWorker.setCustomerSiteWorker(true);
        customerSiteWorker.setCurrentTaskId(UUID.randomUUID());
        customerSiteWorker.setCurrentTaskPayload("客户站点数据处理任务（PII: L3）");

        // Act（执行）
        WorkerStatus saved = workerStatusRepository.save(customerSiteWorker);
        Optional<WorkerStatus> found = workerStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals("cn-beijing-1", found.get().getRegion(),
                        "region 应持久化为 cn-beijing-1"),
                () -> assertTrue(found.get().isCustomerSiteWorker(),
                        "isCustomerSiteWorker 应为 true（客户站点 Worker）"),
                () -> assertNotNull(found.get().getCurrentTaskId(),
                        "currentTaskId 应已持久化"),
                () -> assertEquals("客户站点数据处理任务（PII: L3）",
                        found.get().getCurrentTaskPayload(),
                        "currentTaskPayload 应已持久化（PII: L3 字段）")
        );
    }

    /**
     * 应该持久化隔离 Worker（ISOLATE 动作执行后字段）
     */
    @Test
    @DisplayName("应该持久化隔离 Worker（isIsolated=true + isolatedReason + isolatedAt）")
    void shouldPersistIsolatedWorker() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-iso-" + UUID.randomUUID());
        WorkerStatus isolatedWorker = buildSampleWorker(tenantId, "ai-iso-001",
                WorkerType.AI, WorkerRuntimeStatus.ERROR);
        isolatedWorker.setIsolated(true);  // ISOLATE 动作执行后
        isolatedWorker.setIsolatedReason("Worker 心跳超时 10 分钟，自动隔离以防任务分派失败");
        isolatedWorker.setIsolatedAt(Instant.now());

        // Act（执行）
        WorkerStatus saved = workerStatusRepository.save(isolatedWorker);
        Optional<WorkerStatus> found = workerStatusRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）— 危险动作 ISOLATE 执行后字段持久化验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertTrue(found.get().isIsolated(),
                        "isIsolated 应为 true（ISOLATE 动作已执行）"),
                () -> assertEquals("Worker 心跳超时 10 分钟，自动隔离以防任务分派失败",
                        found.get().getIsolatedReason(),
                        "isolatedReason 应记录隔离原因（审计追溯）"),
                () -> assertNotNull(found.get().getIsolatedAt(),
                        "isolatedAt 应记录隔离时间")
        );
    }

    /**
     * 应该拒绝重复 worker_code（唯一约束 uq_worker_status_code）
     */
    @Test
    @DisplayName("应该拒绝重复 worker_code（唯一约束）")
    void shouldRejectDuplicateWorkerCode() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-dup-" + UUID.randomUUID());
        String duplicateCode = "ai-worker-duplicate-001";
        workerStatusRepository.save(buildSampleWorker(tenantId, duplicateCode,
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // 第二次插入相同 worker_code 应抛异常
        WorkerStatus duplicate = buildSampleWorker(tenantId, duplicateCode,
                WorkerType.AI, WorkerRuntimeStatus.IDLE);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> workerStatusRepository.save(duplicate),
                "重复 worker_code 应抛唯一约束异常");
    }

    /**
     * 应该拒绝缺少必填字段（workerCode 为 null）
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（workerCode 为 null）")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ws-missing-" + UUID.randomUUID());
        WorkerStatus worker = buildSampleWorker(tenantId, "will-be-null",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);
        worker.setWorkerCode(null);  // workerCode 为 NOT NULL

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> workerStatusRepository.save(worker),
                "workerCode 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在的租户（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在的租户（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID fakeTenantId = UUID.randomUUID();  // 不存在的租户 ID
        WorkerStatus worker = buildSampleWorker(fakeTenantId, "ai-fk-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> workerStatusRepository.save(worker),
                "引用不存在的租户应抛外键约束异常");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 WorkerStatus 实体（含必填字段）
     */
    private WorkerStatus buildSampleWorker(UUID tenantId, String workerCode,
                                            WorkerType type, WorkerRuntimeStatus status) {
        WorkerStatus worker = new WorkerStatus();
        worker.setTenantId(tenantId);
        worker.setWorkerCode(workerCode);
        worker.setType(type);
        worker.setStatus(status);
        worker.setProcessedCount(0L);
        worker.setFailedCount(0L);
        worker.setAvgDurationSec(0);
        worker.setCpuPercent(new BigDecimal("45.50"));
        worker.setMemoryPercent(new BigDecimal("62.30"));
        worker.setLastHeartbeat(Instant.now());
        worker.setCustomerSiteWorker(false);
        worker.setIsolated(false);
        return worker;
    }
}
