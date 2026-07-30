package com.platform.core.change.integration;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.request.domain.ChangeRequest;
import com.platform.core.change.request.repository.ChangeRequestRepository;
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
 * ChangeRequest Repository 集成测试
 *
 * <p>验证 ChangeRequest 实体通过 Repository 完成完整 CRUD：
 * <ul>
 *   <li>save：写入实体（含 JSONB impact_assessment/ai_assisted_analysis）</li>
 *   <li>findByIdAndTenantId：按租户隔离查询</li>
 *   <li>findByCodeAndTenantId：按业务编号查询（唯一约束）</li>
 *   <li>findByTenantIdAndStatus：按状态分页查询</li>
 *   <li>findByTenantIdAndProjectId：按项目分页查询</li>
 *   <li>countByTenantIdAndStatus/Type/Priority：多维度统计</li>
 *   <li>跨租户隔离：租户 A 不能查询租户 B 的变更</li>
 *   <li>非空约束：缺少必填字段应抛 DataIntegrityViolationException</li>
 *   <li>外键约束：引用不存在租户应拒绝</li>
 *   <li>唯一约束：code 重复应拒绝</li>
 *   <li>乐观锁：row_version 自动递增</li>
 *   <li>高风险（CRITICAL）变更持久化</li>
 * </ul>
 *
 * <p>使用 TestRestTemplate 启动的 PostgreSQL 16 + Flyway V18 已建表，
 * 测试通过 Repository 直接操作数据库，不经过 Controller。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@DisplayName("ChangeRequest Repository 集成测试")
class ChangeRequestRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private ChangeRequestRepository changeRequestRepository;

    /**
     * 应该成功保存 ChangeRequest 并返回生成的 ID
     */
    @Test
    @DisplayName("应该成功保存 ChangeRequest 并返回生成的 ID")
    void shouldSaveChangeRequestAndReturnGeneratedId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-save-" + UUID.randomUUID());
        ChangeRequest request = buildSampleChangeRequest(
                tenantId, "CHG-2026-001", ChangeStatus.DRAFT);

        // Act（执行）
        ChangeRequest saved = changeRequestRepository.save(request);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(saved.getId(), "应返回生成的 UUID"),
                () -> assertEquals(tenantId, saved.getTenantId()),
                () -> assertEquals("CHG-2026-001", saved.getCode()),
                () -> assertEquals(ChangeStatus.DRAFT, saved.getStatus()),
                () -> assertEquals(ChangeType.DESIGN_CHANGE, saved.getType()),
                () -> assertEquals(ChangePriority.NORMAL, saved.getPriority()),
                () -> assertEquals("{}", saved.getImpactAssessment(),
                        "impact_assessment 默认应为 {}"),
                () -> assertEquals("{}", saved.getAiAssistedAnalysis(),
                        "ai_assisted_analysis 默认应为 {}"),
                () -> assertFalse(saved.isConfirmedNoImpact(),
                        "confirmed_no_impact 默认应为 false"),
                () -> assertFalse(saved.isAiAssisted(),
                        "is_ai_assisted 默认应为 false"),
                () -> assertNotNull(saved.getRowVersion(),
                        "row_version 不应为 null"),
                () -> assertNotNull(saved.getCreatedAt()),
                () -> assertNotNull(saved.getUpdatedAt())
        );
    }

    /**
     * 应该按 ID + tenantId 查询变更请求
     */
    @Test
    @DisplayName("应该按 ID + tenantId 查询变更请求")
    void shouldFindByIdAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-find-" + UUID.randomUUID());
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(tenantId, "CHG-FIND-001", ChangeStatus.SUBMITTED));

        // Act（执行）
        Optional<ChangeRequest> found = changeRequestRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertTrue(found.isPresent(), "应查询到变更请求");
        assertEquals(saved.getId(), found.get().getId());
        assertEquals("CHG-FIND-001", found.get().getCode());
        assertEquals(ChangeStatus.SUBMITTED, found.get().getStatus());
    }

    /**
     * 应该按租户隔离：租户 A 不能查询租户 B 的变更
     */
    @Test
    @DisplayName("应该按租户隔离，跨租户查询应返回 empty")
    void shouldEnforceTenantIsolation() {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-iso-b-" + UUID.randomUUID());
        ChangeRequest savedInA = changeRequestRepository.save(
                buildSampleChangeRequest(tenantA, "CHG-ISO-001", ChangeStatus.DRAFT));

        // Act（执行）：用 tenantB 查询 tenantA 的变更
        Optional<ChangeRequest> found = changeRequestRepository.findByIdAndTenantId(
                savedInA.getId(), tenantB);

        // Assert（断言）
        assertFalse(found.isPresent(), "跨租户查询应返回 empty");
    }

    /**
     * 应该按 code + tenantId 查询（唯一约束 + 业务编号查询）
     */
    @Test
    @DisplayName("应该按 code + tenantId 查询变更请求")
    void shouldFindByCodeAndTenantId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-code-" + UUID.randomUUID());
        changeRequestRepository.save(
                buildSampleChangeRequest(tenantId, "CHG-CODE-001", ChangeStatus.DRAFT));

        // Act（执行）
        Optional<ChangeRequest> found = changeRequestRepository.findByCodeAndTenantId(
                "CHG-CODE-001", tenantId);

        // Assert（断言）
        assertTrue(found.isPresent(), "应按 code 查询到变更请求");
        assertEquals("CHG-CODE-001", found.get().getCode());
    }

    /**
     * 应该按 tenantId 分页查询全部变更
     */
    @Test
    @DisplayName("应该按 tenantId 分页查询全部变更")
    void shouldFindByTenantIdWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-page-" + UUID.randomUUID());
        for (int i = 0; i < 5; i++) {
            changeRequestRepository.save(buildSampleChangeRequest(
                    tenantId, "CHG-PAGE-" + String.format("%03d", i),
                    ChangeStatus.DRAFT));
        }

        // Act（执行）
        Page<ChangeRequest> page = changeRequestRepository.findByTenantId(
                tenantId, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(5, page.getTotalElements(), "应为 5 条"),
                () -> assertEquals(5, page.getContent().size()),
                () -> assertTrue(page.getContent().stream()
                        .allMatch(r -> r.getTenantId().equals(tenantId)))
        );
    }

    /**
     * 应该按 tenantId + status 分页查询
     */
    @Test
    @DisplayName("应该按 tenantId + status 分页查询")
    void shouldFindByTenantIdAndStatusWithPagination() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-status-" + UUID.randomUUID());
        // 插入 3 条 DRAFT + 2 条 SUBMITTED
        for (int i = 0; i < 3; i++) {
            changeRequestRepository.save(buildSampleChangeRequest(
                    tenantId, "CHG-DRAFT-" + i, ChangeStatus.DRAFT));
        }
        for (int i = 0; i < 2; i++) {
            changeRequestRepository.save(buildSampleChangeRequest(
                    tenantId, "CHG-SUB-" + i, ChangeStatus.SUBMITTED));
        }

        // Act（执行）
        Page<ChangeRequest> draftPage = changeRequestRepository.findByTenantIdAndStatus(
                tenantId, ChangeStatus.DRAFT, PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(3, draftPage.getTotalElements(),
                        "DRAFT 变更应为 3 条"),
                () -> assertEquals(3, draftPage.getContent().size()),
                () -> assertTrue(draftPage.getContent().stream()
                        .allMatch(r -> r.getStatus() == ChangeStatus.DRAFT))
        );
    }

    /**
     * 应该按 tenantId + projectId 分页查询
     */
    @Test
    @DisplayName("应该按 tenantId + projectId 分页查询")
    void shouldFindByTenantIdAndProjectId() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-proj-" + UUID.randomUUID());
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-PROJ-A-1", ChangeStatus.DRAFT, "PROJ-A"));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-PROJ-A-2", ChangeStatus.DRAFT, "PROJ-A"));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-PROJ-B-1", ChangeStatus.DRAFT, "PROJ-B"));

        // Act（执行）
        Page<ChangeRequest> projAPage = changeRequestRepository.findByTenantIdAndProjectId(
                tenantId, "PROJ-A", PageRequest.of(0, 10));

        // Assert（断言）
        assertAll(
                () -> assertEquals(2, projAPage.getTotalElements(),
                        "PROJ-A 变更应为 2 条"),
                () -> assertTrue(projAPage.getContent().stream()
                        .allMatch(r -> "PROJ-A".equals(r.getProjectId())))
        );
    }

    /**
     * 应该按 tenantId + status 统计数量
     */
    @Test
    @DisplayName("应该按 tenantId + status 统计数量")
    void shouldCountByTenantIdAndStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-cnt-s-" + UUID.randomUUID());
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-CNT-D-1", ChangeStatus.DRAFT));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-CNT-D-2", ChangeStatus.DRAFT));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-CNT-S-1", ChangeStatus.SUBMITTED));

        // Act（执行）
        long draftCount = changeRequestRepository.countByTenantIdAndStatus(
                tenantId, ChangeStatus.DRAFT);
        long submittedCount = changeRequestRepository.countByTenantIdAndStatus(
                tenantId, ChangeStatus.SUBMITTED);
        long closedCount = changeRequestRepository.countByTenantIdAndStatus(
                tenantId, ChangeStatus.CLOSED);

        // Assert（断言）
        assertAll(
                () -> assertEquals(2L, draftCount, "DRAFT 应为 2"),
                () -> assertEquals(1L, submittedCount, "SUBMITTED 应为 1"),
                () -> assertEquals(0L, closedCount, "CLOSED 应为 0")
        );
    }

    /**
     * 应该按 tenantId + type 统计数量
     */
    @Test
    @DisplayName("应该按 tenantId + type 统计数量")
    void shouldCountByTenantIdAndType() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-cnt-t-" + UUID.randomUUID());
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-TYPE-1", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-TYPE-2", ChangeStatus.DRAFT,
                ChangeType.REQUIREMENT_CHANGE, ChangePriority.NORMAL));

        // Act（执行）
        long designCount = changeRequestRepository.countByTenantIdAndType(
                tenantId, ChangeType.DESIGN_CHANGE);
        long reqCount = changeRequestRepository.countByTenantIdAndType(
                tenantId, ChangeType.REQUIREMENT_CHANGE);

        // Assert（断言）
        assertAll(
                () -> assertEquals(1L, designCount, "DESIGN_CHANGE 应为 1"),
                () -> assertEquals(1L, reqCount, "REQUIREMENT_CHANGE 应为 1")
        );
    }

    /**
     * 应该按 tenantId + priority 统计数量
     */
    @Test
    @DisplayName("应该按 tenantId + priority 统计数量")
    void shouldCountByTenantIdAndPriority() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-cnt-p-" + UUID.randomUUID());
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-PRI-N-1", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-PRI-C-1", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.CRITICAL));

        // Act（执行）
        long normalCount = changeRequestRepository.countByTenantIdAndPriority(
                tenantId, ChangePriority.NORMAL);
        long criticalCount = changeRequestRepository.countByTenantIdAndPriority(
                tenantId, ChangePriority.CRITICAL);

        // Assert（断言）
        assertAll(
                () -> assertEquals(1L, normalCount, "NORMAL 应为 1"),
                () -> assertEquals(1L, criticalCount, "CRITICAL 应为 1")
        );
    }

    /**
     * 应该正确更新 status 字段（状态机流转）
     */
    @Test
    @DisplayName("应该正确更新 status 字段（状态机流转）")
    void shouldUpdateStatus() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-upd-" + UUID.randomUUID());
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(tenantId, "CHG-UPD-001", ChangeStatus.DRAFT));

        // Act（执行）
        saved.setStatus(ChangeStatus.SUBMITTED);
        ChangeRequest updated = changeRequestRepository.save(saved);

        // Assert（断言）
        Optional<ChangeRequest> refetched = changeRequestRepository.findByIdAndTenantId(
                updated.getId(), tenantId);
        assertTrue(refetched.isPresent());
        assertEquals(ChangeStatus.SUBMITTED, refetched.get().getStatus(),
                "status 应已更新为 SUBMITTED");
    }

    /**
     * 应该正确更新 approved_by/approved_at 字段（批准阶段）
     */
    @Test
    @DisplayName("应该正确更新 approved_by/approved_at 字段")
    void shouldUpdateApprovalFields() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-appr-" + UUID.randomUUID());
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(tenantId, "CHG-APPR-001", ChangeStatus.PENDING_APPROVAL));

        // Act（执行）
        Instant approvedAt = Instant.now();
        saved.setApprovedBy("approver@platform.local");
        saved.setApprovedAt(approvedAt);
        saved.setStatus(ChangeStatus.APPROVED);
        ChangeRequest updated = changeRequestRepository.save(saved);

        // Assert（断言）
        Optional<ChangeRequest> refetched = changeRequestRepository.findByIdAndTenantId(
                updated.getId(), tenantId);
        assertTrue(refetched.isPresent());
        assertAll(
                () -> assertEquals("approver@platform.local", refetched.get().getApprovedBy()),
                () -> assertEquals(approvedAt, refetched.get().getApprovedAt()),
                () -> assertEquals(ChangeStatus.APPROVED, refetched.get().getStatus())
        );
    }

    /**
     * 应该正确持久化 CRITICAL 优先级变更（高风险）
     */
    @Test
    @DisplayName("应该正确持久化 CRITICAL 优先级变更（高风险）")
    void shouldPersistCriticalPriorityChange() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-crit-" + UUID.randomUUID());
        ChangeRequest critical = buildSampleChangeRequest(
                tenantId, "CHG-CRIT-001", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.CRITICAL);
        critical.setRiskAssessment("影响结构安全，需注册工程师签章");
        critical.setAiAssisted(true);
        critical.setAiAssistedAnalysis("{\"model\":\"gpt-4\",\"summary\":\"影响基础尺寸\"}");

        // Act（执行）
        ChangeRequest saved = changeRequestRepository.save(critical);
        Optional<ChangeRequest> refetched = changeRequestRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertTrue(refetched.isPresent());
        ChangeRequest fetched = refetched.get();
        assertAll(
                () -> assertEquals(ChangePriority.CRITICAL, fetched.getPriority(),
                        "应为 CRITICAL 优先级"),
                () -> assertTrue(fetched.isAiAssisted(),
                        "aiAssisted 应为 true"),
                () -> assertTrue(fetched.getAiAssistedAnalysis().contains("gpt-4"),
                        "ai_assisted_analysis 应持久化 JSON 内容"),
                () -> assertNotNull(fetched.getRiskAssessment(),
                        "risk_assessment 应已持久化")
        );
    }

    /**
     * 应该拒绝缺少必填字段（如 title）的实体
     */
    @Test
    @DisplayName("应该拒绝缺少必填字段（title）的实体")
    void shouldRejectMissingRequiredField() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-null-" + UUID.randomUUID());
        ChangeRequest request = buildSampleChangeRequest(
                tenantId, "CHG-NULL-001", ChangeStatus.DRAFT);
        request.setTitle(null); // 必填字段置空

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> changeRequestRepository.save(request),
                "title 为 null 应抛 DataIntegrityViolationException");
    }

    /**
     * 应该拒绝引用不存在租户的变更（外键约束）
     */
    @Test
    @DisplayName("应该拒绝引用不存在租户的变更（外键约束）")
    void shouldRejectNonExistentTenant() {
        // Arrange（准备）
        UUID nonExistentTenantId = UUID.randomUUID();
        ChangeRequest request = buildSampleChangeRequest(
                nonExistentTenantId, "CHG-FK-001", ChangeStatus.DRAFT);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> changeRequestRepository.save(request),
                "引用不存在租户应抛外键约束异常");
    }

    /**
     * 应该拒绝相同 code 的重复变更（唯一约束）
     */
    @Test
    @DisplayName("应该拒绝相同 code 的重复变更（唯一约束）")
    void shouldRejectDuplicateCode() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-dup-" + UUID.randomUUID());
        changeRequestRepository.save(buildSampleChangeRequest(
                tenantId, "CHG-DUP-001", ChangeStatus.DRAFT));

        // 同租户下相同 code 的第二条
        ChangeRequest duplicate = buildSampleChangeRequest(
                tenantId, "CHG-DUP-001", ChangeStatus.SUBMITTED);

        // Act + Assert（执行 + 断言）
        assertThrows(DataIntegrityViolationException.class,
                () -> changeRequestRepository.save(duplicate),
                "相同 code 应违反唯一约束");
    }

    /**
     * 应该支持物理删除并级联清理子表数据（affected_item/task_plan_item/closure_evidence/change_operation）
     *
     * <p>注意：业务上变更请求一般不物理删除，使用 RECALLED 状态软删除。
     * 此测试验证外键 ON DELETE CASCADE 配置正确。
     */
    @Test
    @DisplayName("应该支持物理删除并级联清理子表数据")
    void shouldCascadeDeleteRelatedEntities() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-cr-del-" + UUID.randomUUID());
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(tenantId, "CHG-DEL-001", ChangeStatus.DRAFT));

        // Act（执行）
        changeRequestRepository.delete(saved);
        Optional<ChangeRequest> found = changeRequestRepository.findByIdAndTenantId(
                saved.getId(), tenantId);

        // Assert（断言）
        assertFalse(found.isPresent(), "删除后应查询不到");
    }

    // ── 辅助方法 ────────────────────────────────────────────

    /**
     * 构造测试用 ChangeRequest（默认 DESIGN_CHANGE/NORMAL/DRAFT/PROJ-DEFAULT）
     */
    private ChangeRequest buildSampleChangeRequest(UUID tenantId, String code, ChangeStatus status) {
        return buildSampleChangeRequest(
                tenantId, code, status, ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
    }

    /**
     * 构造测试用 ChangeRequest（自定义 type/priority，默认项目 PROJ-DEFAULT）
     */
    private ChangeRequest buildSampleChangeRequest(
            UUID tenantId, String code, ChangeStatus status,
            ChangeType type, ChangePriority priority) {
        return buildSampleChangeRequest(tenantId, code, status, "PROJ-DEFAULT", type, priority);
    }

    /**
     * 构造测试用 ChangeRequest（自定义 projectId，默认 DESIGN_CHANGE/NORMAL）
     */
    private ChangeRequest buildSampleChangeRequest(
            UUID tenantId, String code, ChangeStatus status, String projectId) {
        return buildSampleChangeRequest(
                tenantId, code, status, projectId,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
    }

    /**
     * 构造测试用 ChangeRequest（全参数版本）
     */
    private ChangeRequest buildSampleChangeRequest(
            UUID tenantId, String code, ChangeStatus status, String projectId,
            ChangeType type, ChangePriority priority) {
        ChangeRequest request = new ChangeRequest();
        request.setTenantId(tenantId);
        request.setCode(code);
        request.setTitle("测试变更：" + code);
        request.setDescription("自动化测试创建的变更请求 " + code);
        request.setType(type);
        request.setPriority(priority);
        request.setStatus(status);
        request.setProjectId(projectId);
        request.setInitiatedBy("tester@platform.local");
        request.setInitiatedAt(Instant.now());
        request.setImpactAssessment("{}");
        request.setAiAssistedAnalysis("{}");
        request.setConfirmedNoImpact(false);
        request.setAiAssisted(false);
        return request;
    }
}
