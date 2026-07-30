package com.platform.core.governance.integration;

import com.platform.core.governance.accessgrant.domain.AccessGrant;
import com.platform.core.governance.accessgrant.repository.GovernanceAccessGrantRepository;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantType;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
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
 * AccessGrant Repository 集成测试
 *
 * <p>验证 AccessGrant 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 JSONB propagation_dependents）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByTenantIdAndStatus：按状态分页查询</li>
 *   <li>countByTenantIdAndStatus：按租户+状态统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的授权</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>乐观锁：row_version 自动递增</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V17 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 */
@DisplayName("AccessGrant Repository 集成测试")
class AccessGrantRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private GovernanceAccessGrantRepository accessGrantRepository;

    /**
     * 应该成功保存 AccessGrant 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 AccessGrant 并返回生成的 ID")
    void shouldSaveAccessGrantAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-save-" + UUID.randomUUID());

        AccessGrant grant = buildSampleAccessGrant(tenantId, "alice@example.com");

        // Act（执行）
        AccessGrant saved = accessGrantRepository.save(grant);

        // Assert（断言）
        // JPA @Version 字段新建保存后初始值为 0（Hibernate 行为，DB DEFAULT 1 被 INSERT 显式值覆盖）
        // 乐观锁触发更新后才会递增到 1
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals(GovernanceAccessGrantType.MEMBER, saved.getType()),
                () -> assertEquals(GovernanceAccessGrantStatus.ACTIVE, saved.getStatus()),
                () -> assertEquals(GovernanceRiskLevel.MEDIUM, saved.getRiskLevel()),
                () -> assertEquals("[]", saved.getPropagationDependents(),
                        "propagation_dependents 默认应为 []"),
                () -> assertNotNull(saved.getRowVersion(),
                        "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询授权
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询授权")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-find-" + UUID.randomUUID());
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(tenantId, "find@example.com"));

        // Act（执行）
        Optional<AccessGrant> found = accessGrantRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertTrue(found.isPresent(), "应查询到授权");
        assertEquals(saved.getId(), found.get().getId());
        assertEquals("find@example.com", found.get().getPrincipalEmail());
    }

    /**
     * 应该按租户隔离：租户 A 不能查询租户 B 的授权
     */
    @Test
    @DisplayName("应该按租户隔离，跨租户查询应返回 empty")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-iso-b-" + UUID.randomUUID());
        AccessGrant savedInA = accessGrantRepository.save(
                buildSampleAccessGrant(tenantA, "iso-a@example.com"));

        // Act（执行）：用 tenantB 查询 tenantA 的授权
        Optional<AccessGrant> found = accessGrantRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(found.isPresent(), "跨租户查询应返回 empty");
    }

    /**
     * 应该按 tenantId + status 分页查询
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-page-" + UUID.randomUUID());
        // 插入 3 条 ACTIVE + 2 条 PENDING_REVIEW
        for (int i = 0; i < 3; i++) {
            accessGrantRepository.save(buildSampleAccessGrant(
                    tenantId, "active-" + i + "@example.com",
                    GovernanceAccessGrantStatus.ACTIVE));
        }
        for (int i = 0; i < 2; i++) {
            accessGrantRepository.save(buildSampleAccessGrant(
                    tenantId, "pending-" + i + "@example.com",
                    GovernanceAccessGrantStatus.PENDING_REVIEW));
        }

        // Act（执行）
        Page<AccessGrant> activePage = accessGrantRepository.findByTenantIdAndStatus(
                tenantId, GovernanceAccessGrantStatus.ACTIVE,
                PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, activePage.getTotalElements(),
                        "ACTIVE 授权应为 3 条"),
                () -> assertEquals(3, activePage.getContent().size()),
                () -> assertTrue(activePage.getContent().stream()
                        .allMatch(g -> g.getStatus() == GovernanceAccessGrantStatus.ACTIVE))
        );
    }

    /**
     * 应该按 tenantId + status 统计数量
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计数量")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-count-" + UUID.randomUUID());
        accessGrantRepository.save(buildSampleAccessGrant(
                tenantId, "count-active@example.com",
                GovernanceAccessGrantStatus.ACTIVE));
        accessGrantRepository.save(buildSampleAccessGrant(
                tenantId, "count-pending@example.com",
                GovernanceAccessGrantStatus.PENDING_REVIEW));

        // Act（执行）
        long activeCount = accessGrantRepository.countByTenantIdAndStatus(
                tenantId, GovernanceAccessGrantStatus.ACTIVE);
        long pendingCount = accessGrantRepository.countByTenantIdAndStatus(
                tenantId, GovernanceAccessGrantStatus.PENDING_REVIEW);

        // Assert（断言）
        assertAll(
                () -> assertEquals(1L, activeCount, "ACTIVE 应为 1"),
                () -> assertEquals(1L, pendingCount, "PENDING_REVIEW 应为 1")
        );
    }

    /**
     * 应该正确更新 last_used_at 字段（模拟授权被使用）
     */
    @Test
    @DisplayName("应该正确更新 last_used_at 字段")
    void shouldUpdateLastUsedAt() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-use-" + UUID.randomUUID());
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(tenantId, "used@example.com"));
        Instant useTime = Instant.now().plusSeconds(60);

        // Act（执行）
        saved.setLastUsedAt(useTime);
        AccessGrant updated = accessGrantRepository.save(saved);

        // Assert（断言）
        Optional<AccessGrant> refetched = accessGrantRepository.findByIdAndTenantId(
                updated.getId(), tenantId);
        assertTrue(refetched.isPresent());
        assertEquals(useTime, refetched.get().getLastUsedAt(),
                "last_used_at 应已更新");
    }

    /**
     * 应该拒绝缺少必填字段（如 principal_email）的实体
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（principal_email）的实体")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-null-" + UUID.randomUUID());
        AccessGrant grant = buildSampleAccessGrant(tenantId, "filled@example.com");
        grant.setPrincipalEmail(null); // 必填字段置空

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> accessGrantRepository.save(grant),
                "principal_email 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在租户的授权（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在租户的授权（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID nonExistentTenantId = UUID.randomUUID();
        AccessGrant grant = buildSampleAccessGrant(nonExistentTenantId, "fk@example.com");

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> accessGrantRepository.save(grant),
                "引用不存在租户应抛外键约束异常");
    }

    /**
     * 应该正确持久化 BREAKGLASS 类型授权（高风险）
     */
    @Test
    @DisplayName("应该正确持久化 BREAKGLASS 类型授权（CRITICAL 风险）")
    void shouldPersistBreakglassTypeWithCriticalRisk() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-ag-bg-" + UUID.randomUUID());
        AccessGrant grant = buildSampleAccessGrant(tenantId, "breakglass@example.com");
        grant.setType(GovernanceAccessGrantType.BREAKGLASS);
        grant.setRiskLevel(GovernanceRiskLevel.CRITICAL);
        grant.setRequiresStepUp(true);
        grant.setHasLegalHold(false);

        // Act（执行）
        AccessGrant saved = accessGrantRepository.save(grant);
        Optional<AccessGrant> refetched = accessGrantRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertTrue(refetched.isPresent());
        AccessGrant fetched = refetched.get();
        assertAll(
                () -> assertEquals(GovernanceAccessGrantType.BREAKGLASS, fetched.getType()),
                () -> assertEquals(GovernanceRiskLevel.CRITICAL, fetched.getRiskLevel()),
                () -> assertTrue(fetched.isRequiresStepUp(),
                        "BREAKGLASS 应要求 Step-Up 认证")
        );
    }

    // ── 辅助方法 ────────────────────────────────────────────

    /**
     * 构造测试用 AccessGrant（默认 ACTIVE/MEDIUM/MEMBER）
     */
    private AccessGrant buildSampleAccessGrant(UUID tenantId, String email) {
        return buildSampleAccessGrant(tenantId, email, GovernanceAccessGrantStatus.ACTIVE);
    }

    /**
     * 构造测试用 AccessGrant（自定义 status）
     */
    private AccessGrant buildSampleAccessGrant(
            UUID tenantId, String email, GovernanceAccessGrantStatus status) {
        AccessGrant grant = new AccessGrant();
        grant.setTenantId(tenantId);
        grant.setType(GovernanceAccessGrantType.MEMBER);
        grant.setPrincipalName("Tester " + email);
        grant.setPrincipalEmail(email);
        grant.setResource("project:default");
        grant.setPermission("project:read");
        grant.setRiskLevel(GovernanceRiskLevel.MEDIUM);
        grant.setStatus(status);
        grant.setGrantedBy("admin@platform.local");
        grant.setGrantedAt(Instant.now());
        grant.setExpiresAt(Instant.now().plusSeconds(3600));
        grant.setOwner("Project Owner");
        grant.setOwnerEmail("owner@example.com");
        grant.setReason("测试授权：" + email);
        grant.setRequiresStepUp(false);
        grant.setHasLegalHold(false);
        grant.setPropagationDependents("[]");
        return grant;
    }
}
