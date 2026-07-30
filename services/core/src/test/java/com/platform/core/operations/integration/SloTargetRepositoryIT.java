package com.platform.core.operations.integration;

import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.slo.domain.SloTarget;
import com.platform.core.operations.slo.repository.SloTargetRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SloTarget Repository 集成测试
 *
 * <p>验证 SloTarget 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 BigDecimal 精度字段 availabilityTarget/availabilityCurrent/errorBudgetRemaining）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndStatus：按状态分页查询（HEALTHY/WARNING/CRITICAL）</li>
 *   <li>countByTenantIdAndStatus：状态统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的 SLO</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 *   <li>CRITICAL SLO 场景持久化（错误预算已突破）</li>
 *   <li>状态流转（HEALTHY → WARNING → CRITICAL）</li>
 *   <li>BigDecimal 精度保留（availabilityTarget=0.999 表示 99.9%）</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V19 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D42-SLO-容量.md
 */
@DisplayName("SloTarget Repository 集成测试")
class SloTargetRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private SloTargetRepository sloTargetRepository;

    /**
     * 应该成功保存 SloTarget 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 SloTarget 并返回生成的 ID")
    void shouldSaveSloTargetAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-save-" + UUID.randomUUID());
        SloTarget slo = buildSampleSloTarget(tenantId, "API 可用率", SloStatus.HEALTHY);

        // Act（执行）
        SloTarget saved = sloTargetRepository.save(slo);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals("API 可用率", saved.getName()),
                () -> assertEquals(0, new BigDecimal("0.999").compareTo(saved.getAvailabilityTarget()),
                        "availabilityTarget 应为 0.999（99.9%）"),
                () -> assertEquals(0, new BigDecimal("0.9995").compareTo(saved.getAvailabilityCurrent()),
                        "availabilityCurrent 应为 0.9995"),
                () -> assertEquals(0, new BigDecimal("50.0000").compareTo(saved.getErrorBudgetRemaining()),
                        "errorBudgetRemaining 应为 50.0000"),
                () -> assertEquals(10000L, saved.getRequestCount24h()),
                () -> assertEquals(5L, saved.getErrorCount24h()),
                () -> assertEquals(200, saved.getP95LatencyMs()),
                () -> assertEquals(500, saved.getP99LatencyMs()),
                () -> assertEquals(SloStatus.HEALTHY, saved.getStatus()),
                () -> assertEquals("api-service", saved.getServiceName()),
                () -> assertEquals(28, saved.getWindowDays(), "window_days 默认应为 28"),
                () -> assertNotNull(saved.getRowVersion(), "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询 SLO
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询 SLO")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-find-" + UUID.randomUUID());
        SloTarget saved = sloTargetRepository.save(
                buildSampleSloTarget(tenantId, "AI 生成延迟", SloStatus.WARNING));

        // Act（执行）
        Optional<SloTarget> found = sloTargetRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent(), "应能找到 SLO"),
                () -> assertEquals(saved.getId(), found.get().getId()),
                () -> assertEquals(tenantId, found.get().getTenantId()),
                () -> assertEquals("AI 生成延迟", found.get().getName()),
                () -> assertEquals(SloStatus.WARNING, found.get().getStatus())
        );
    }

    /**
     * 应该强制租户隔离（跨租户查询返回 empty）
     */
    @Test
    @DisplayName("应该强制租户隔离（跨租户查询返回 empty）")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-slo-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-slo-iso-b-" + UUID.randomUUID());
        SloTarget savedInA = sloTargetRepository.save(
                buildSampleSloTarget(tenantA, "API 可用率", SloStatus.HEALTHY));

        // Act（执行）
        Optional<SloTarget> foundInB = sloTargetRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(foundInB.isPresent(), "租户 B 不应能查询租户 A 的 SLO");
    }

    /**
     * 应该按 tenantId 分页查询 SLO 列表
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询 SLO 列表")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            sloTargetRepository.save(
                    buildSampleSloTarget(tenantId, "SLO-" + i, SloStatus.HEALTHY));
        }

        // Act（执行）
        Page<SloTarget> page = sloTargetRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements()),
                () -> assertEquals(1, page.getTotalPages()),
                () -> assertEquals(5, page.getContent().size())
        );
    }

    /**
     * 应该按 tenantId + status 分页查询（区分 HEALTHY/WARNING/CRITICAL）
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-status-" + UUID.randomUUID());
        // 3 个 HEALTHY + 2 个 WARNING + 1 个 CRITICAL
        for (int i = 0; i < 3; i++) {
            sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-H-" + i, SloStatus.HEALTHY));
        }
        for (int i = 0; i < 2; i++) {
            sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-W-" + i, SloStatus.WARNING));
        }
        sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-C-1", SloStatus.CRITICAL));

        // Act（执行）
        Page<SloTarget> healthy = sloTargetRepository.findByTenantIdAndStatus(
                tenantId, SloStatus.HEALTHY, PageRequest.of(0, 10));
        Page<SloTarget> warning = sloTargetRepository.findByTenantIdAndStatus(
                tenantId, SloStatus.WARNING, PageRequest.of(0, 10));
        Page<SloTarget> critical = sloTargetRepository.findByTenantIdAndStatus(
                tenantId, SloStatus.CRITICAL, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, healthy.getTotalElements(), "HEALTHY 应有 3 个"),
                () -> assertEquals(2, warning.getTotalElements(), "WARNING 应有 2 个"),
                () -> assertEquals(1, critical.getTotalElements(), "CRITICAL 应有 1 个")
        );
    }

    /**
     * 应该按 tenantId + status 统计数量
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计数量")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-count-" + UUID.randomUUID());
        sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-H-1", SloStatus.HEALTHY));
        sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-H-2", SloStatus.HEALTHY));
        sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-W-1", SloStatus.WARNING));
        sloTargetRepository.save(buildSampleSloTarget(tenantId, "SLO-C-1", SloStatus.CRITICAL));

        // Act（执行）
        long healthyCount = sloTargetRepository.countByTenantIdAndStatus(tenantId, SloStatus.HEALTHY);
        long warningCount = sloTargetRepository.countByTenantIdAndStatus(tenantId, SloStatus.WARNING);
        long criticalCount = sloTargetRepository.countByTenantIdAndStatus(tenantId, SloStatus.CRITICAL);

        // Assert（断言）
        assertAll(
                () -> assertEquals(2L, healthyCount, "HEALTHY 应有 2 个"),
                () -> assertEquals(1L, warningCount, "WARNING 应有 1 个"),
                () -> assertEquals(1L, criticalCount, "CRITICAL 应有 1 个")
        );
    }

    /**
     * 应该持久化 CRITICAL SLO 场景（错误预算已突破为负数）
     */
    @Test
    @DisplayName("应该持久化 CRITICAL SLO 场景（错误预算已突破为负数）")
    void shouldPersistCriticalSloScenario() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-critical-" + UUID.randomUUID());
        SloTarget criticalSlo = buildSampleSloTarget(tenantId, "AI 生成可用率", SloStatus.CRITICAL);
        // 错误预算已突破：-15.5000 表示已超用 15.5%
        criticalSlo.setErrorBudgetRemaining(new BigDecimal("-15.5000"));
        criticalSlo.setAvailabilityCurrent(new BigDecimal("0.9850"));  // 98.50%（低于 99.9% 目标）
        criticalSlo.setErrorCount24h(150L);  // 24h 错误 150 次（高错误率）
        criticalSlo.setRequestCount24h(10000L);

        // Act（执行）
        SloTarget saved = sloTargetRepository.save(criticalSlo);
        Optional<SloTarget> found = sloTargetRepository.findByIdAndTenantId(saved.getId(), tenantId);

        // Assert（断言）
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(SloStatus.CRITICAL, found.get().getStatus(),
                        "状态应为 CRITICAL"),
                () -> assertTrue(found.get().getErrorBudgetRemaining().compareTo(BigDecimal.ZERO) < 0,
                        "errorBudgetRemaining 应为负数（已突破错误预算）"),
                () -> assertEquals(0, new BigDecimal("-15.5000").compareTo(found.get().getErrorBudgetRemaining()),
                        "errorBudgetRemaining 应为 -15.5000"),
                () -> assertEquals(0, new BigDecimal("0.9850").compareTo(found.get().getAvailabilityCurrent()),
                        "availabilityCurrent 应为 0.9850（98.50%）"),
                () -> assertEquals(150L, found.get().getErrorCount24h(),
                        "errorCount24h 应为 150（高错误率）"),
                () -> assertEquals(10000L, found.get().getRequestCount24h())
        );
    }

    /**
     * 应该持久化 BigDecimal 精度（availabilityTarget=0.999 表示 99.9%）
     */
    @Test
    @DisplayName("应该持久化 BigDecimal 精度（availabilityTarget=0.999 表示 99.9%）")
    void shouldPersistBigDecimalPrecision() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-precision-" + UUID.randomUUID());
        SloTarget slo = buildSampleSloTarget(tenantId, "高精度 SLO", SloStatus.HEALTHY);
        slo.setAvailabilityTarget(new BigDecimal("0.9999"));  // 99.99%
        slo.setAvailabilityCurrent(new BigDecimal("0.99995"));  // 99.995%
        slo.setErrorBudgetRemaining(new BigDecimal("80.1234"));

        // Act（执行）
        SloTarget saved = sloTargetRepository.save(slo);
        Optional<SloTarget> found = sloTargetRepository.findByIdAndTenantId(saved.getId(), tenantId);

        // Assert（断言）— BigDecimal 精度保留验证
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(0, new BigDecimal("0.9999").compareTo(found.get().getAvailabilityTarget()),
                        "availabilityTarget 应保留 0.9999（99.99%）"),
                () -> assertEquals(0, new BigDecimal("0.99995").compareTo(found.get().getAvailabilityCurrent()),
                        "availabilityCurrent 应保留 0.99995（99.995%）"),
                () -> assertEquals(0, new BigDecimal("80.1234").compareTo(found.get().getErrorBudgetRemaining()),
                        "errorBudgetRemaining 应保留 80.1234 精度")
        );
    }

    /**
     * 应该持久化状态流转（HEALTHY → WARNING → CRITICAL）
     */
    @Test
    @DisplayName("应该持久化状态流转（HEALTHY → WARNING → CRITICAL）")
    void shouldPersistStatusTransition() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-transition-" + UUID.randomUUID());
        SloTarget slo = sloTargetRepository.save(
                buildSampleSloTarget(tenantId, "状态流转 SLO", SloStatus.HEALTHY));

        // Act（执行）HEALTHY → WARNING
        slo.setStatus(SloStatus.WARNING);
        slo.setErrorBudgetRemaining(new BigDecimal("30.0000"));  // 错误预算消耗过半
        SloTarget warning = sloTargetRepository.save(slo);

        // WARNING → CRITICAL
        warning.setStatus(SloStatus.CRITICAL);
        warning.setErrorBudgetRemaining(new BigDecimal("-5.0000"));  // 错误预算突破
        warning.setAvailabilityCurrent(new BigDecimal("0.9850"));  // 可用率下降
        SloTarget critical = sloTargetRepository.save(warning);

        // Assert（断言）
        Optional<SloTarget> found = sloTargetRepository.findByIdAndTenantId(critical.getId(), tenantId);
        assertAll(
                () -> assertTrue(found.isPresent()),
                () -> assertEquals(SloStatus.CRITICAL, found.get().getStatus(),
                        "状态应为 CRITICAL"),
                () -> assertEquals(0, new BigDecimal("-5.0000").compareTo(found.get().getErrorBudgetRemaining()),
                        "errorBudgetRemaining 应为 -5.0000"),
                () -> assertEquals(0, new BigDecimal("0.9850").compareTo(found.get().getAvailabilityCurrent()),
                        "availabilityCurrent 应为 0.9850")
        );
    }

    /**
     * 应该拒绝缺少必填字段（name 为 null）
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（name 为 null）")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-slo-missing-" + UUID.randomUUID());
        SloTarget slo = buildSampleSloTarget(tenantId, "测试 SLO", SloStatus.HEALTHY);
        slo.setName(null);  // name 为 NOT NULL

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> sloTargetRepository.save(slo),
                "name 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在的租户（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在的租户（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID fakeTenantId = UUID.randomUUID();  // 不存在的租户 ID
        SloTarget slo = buildSampleSloTarget(fakeTenantId, "外键测试 SLO", SloStatus.HEALTHY);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> sloTargetRepository.save(slo),
                "引用不存在的租户应抛外键约束异常");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 构建示例 SloTarget 实体（含必填字段）
     */
    private SloTarget buildSampleSloTarget(UUID tenantId, String name, SloStatus status) {
        SloTarget slo = new SloTarget();
        slo.setTenantId(tenantId);
        slo.setName(name);
        slo.setAvailabilityTarget(new BigDecimal("0.999"));    // 99.9%
        slo.setAvailabilityCurrent(new BigDecimal("0.9995"));   // 99.95%
        slo.setErrorBudgetRemaining(new BigDecimal("50.0000")); // 50% 剩余
        slo.setRequestCount24h(10000L);
        slo.setErrorCount24h(5L);
        slo.setP95LatencyMs(200);
        slo.setP99LatencyMs(500);
        slo.setStatus(status);
        slo.setServiceName("api-service");
        slo.setWindowDays(28);
        return slo;
    }
}
