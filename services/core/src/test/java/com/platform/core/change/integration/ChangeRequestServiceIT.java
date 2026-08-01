package com.platform.core.change.integration;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.request.domain.ChangeRequest;
import com.platform.core.change.request.dto.ApproveChangeRequestRequest;
import com.platform.core.change.request.dto.ChangeRequestDto;
import com.platform.core.change.request.dto.CreateChangeRequestRequest;
import com.platform.core.change.request.dto.ListChangeRequestsRequest;
import com.platform.core.change.request.dto.RecallChangeRequestRequest;
import com.platform.core.change.request.dto.RejectChangeRequestRequest;
import com.platform.core.change.request.dto.SubmitImpactAssessmentRequest;
import com.platform.core.change.request.dto.VerifyClosureRequest;
import com.platform.core.change.request.repository.ChangeRequestRepository;
import com.platform.core.change.request.service.ChangeRequestService;
import com.platform.core.common.response.BusinessException;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ChangeRequest Service 集成测试
 *
 * <p>验证 ChangeRequestService 状态机流转与安全红线：
 * <ul>
 *   <li>createChangeRequest：创建草稿，自动生成 code</li>
 *   <li>updateChangeRequest：仅 DRAFT 状态可编辑</li>
 *   <li>deleteChangeRequest：仅 DRAFT 状态可删除</li>
 *   <li>listChangeRequests：多条件过滤 + 分页</li>
 *   <li>getChangeRequest：详情查询，不存在抛 NOT_FOUND</li>
 *   <li>submitImpactAssessment：CRITICAL 强制 stepUpToken，状态机校验</li>
 *   <li>approveChangeRequest：责任确认 + stepUpToken + 职责分离（批准人≠发起人）</li>
 *   <li>rejectChangeRequest：stepUpToken + 状态机校验</li>
 *   <li>recallChangeRequest：仅发起人可撤回，CLOSED 不可撤回</li>
 *   <li>verifyClosure：责任确认 + stepUpToken + 职责分离（关闭人≠批准人≠实施人）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@DisplayName("ChangeRequest Service 集成测试")
class ChangeRequestServiceIT extends AbstractIntegrationTest {

    @Autowired
    private ChangeRequestService changeRequestService;

    @Autowired
    private ChangeRequestRepository changeRequestRepository;

    // ── 创建 ──

    /**
     * 应该成功创建 DRAFT 状态变更请求并自动生成 code
     */
    @Test
    @DisplayName("应该成功创建 DRAFT 状态变更请求并自动生成 code")
    void shouldCreateDraftChangeRequest() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-create-" + UUID.randomUUID());
        CreateChangeRequestRequest request = new CreateChangeRequestRequest(
                "测试变更请求",
                "测试描述",
                ChangeType.DESIGN_CHANGE,
                ChangePriority.NORMAL,
                "PROJ-TEST",
                null,
                null);

        // Act（执行）
        ChangeRequestDto dto = changeRequestService.createChangeRequest(
                tenantId, "initiator@platform.local", request);

        // Assert（断言）
        assertAll(
                () -> assertNotNull(dto.id(), "应生成 ID"),
                () -> assertNotNull(dto.code(), "应自动生成 code"),
                () -> assertTrue(dto.code().startsWith("CHG-"), "code 应以 CHG- 前缀"),
                () -> assertEquals("测试变更请求", dto.title()),
                () -> assertEquals(ChangeStatus.DRAFT, dto.status(), "默认状态应为 DRAFT"),
                () -> assertEquals(ChangeType.DESIGN_CHANGE, dto.type()),
                () -> assertEquals(ChangePriority.NORMAL, dto.priority()),
                () -> assertEquals("PROJ-TEST", dto.projectId()),
                () -> assertEquals("initiator@platform.local", dto.initiatedBy()),
                () -> assertNotNull(dto.initiatedAt()),
                () -> assertNull(dto.approvedBy(), "草稿状态 approvedBy 应为 null"),
                () -> assertFalse(dto.confirmedNoImpact(), "草稿状态 confirmedNoImpact 应为 false"),
                () -> assertFalse(dto.isAiAssisted(), "草稿状态 isAiAssisted 应为 false")
        );
    }

    // ── 更新 ──

    /**
     * 应该在 DRAFT 状态下成功更新变更请求
     */
    @Test
    @DisplayName("应该在 DRAFT 状态下成功更新变更请求")
    void shouldUpdateDraftChangeRequest() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-upd-" + UUID.randomUUID());
        ChangeRequest draft = changeRequestRepository.save(
                buildChangeRequest(tenantId, "CHG-UPD-001", ChangeStatus.DRAFT,
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        CreateChangeRequestRequest updateRequest = new CreateChangeRequestRequest(
                "更新后的标题",
                "更新后的描述",
                ChangeType.REQUIREMENT_CHANGE,
                ChangePriority.MAJOR,
                "PROJ-UPD",
                null,
                null);

        // Act（执行）
        ChangeRequestDto dto = changeRequestService.updateChangeRequest(
                tenantId, draft.getId(), updateRequest);

        // Assert（断言）
        assertAll(
                () -> assertEquals("更新后的标题", dto.title()),
                () -> assertEquals("更新后的描述", dto.description()),
                () -> assertEquals(ChangeType.REQUIREMENT_CHANGE, dto.type()),
                () -> assertEquals(ChangePriority.MAJOR, dto.priority()),
                () -> assertEquals("PROJ-UPD", dto.projectId())
        );
    }

    /**
     * 应该拒绝在非 DRAFT 状态下更新变更请求
     */
    @Test
    @DisplayName("应该拒绝在非 DRAFT 状态下更新变更请求")
    void shouldRejectUpdateWhenNotDraft() {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-svc-upd-reject-" + UUID.randomUUID());
        ChangeRequest submitted = changeRequestRepository.save(
                buildChangeRequest(tenantId, "CHG-UPD-REJ-001", ChangeStatus.SUBMITTED,
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        CreateChangeRequestRequest updateRequest = new CreateChangeRequestRequest(
                "尝试更新", null, ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL,
                "PROJ-TEST", null, null);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.updateChangeRequest(
                        tenantId, submitted.getId(), updateRequest));
        assertEquals(ChangeStatus.SUBMITTED.name(),
                ex.getMessage().substring(ex.getMessage().lastIndexOf(": ") + 2));
    }

    // ── 删除 ──

    /**
     * 应该在 DRAFT 状态下成功删除变更请求
     */
    @Test
    @DisplayName("应该在 DRAFT 状态下成功删除变更请求")
    void shouldDeleteDraftChangeRequest() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-del-" + UUID.randomUUID());
        ChangeRequest draft = changeRequestRepository.save(
                buildChangeRequest(tenantId, "CHG-DEL-001", ChangeStatus.DRAFT,
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act
        changeRequestService.deleteChangeRequest(tenantId, draft.getId());

        // Assert
        assertTrue(changeRequestRepository.findByIdAndTenantId(draft.getId(), tenantId).isEmpty(),
                "删除后应查询不到");
    }

    /**
     * 应该拒绝在非 DRAFT 状态下删除变更请求
     */
    @Test
    @DisplayName("应该拒绝在非 DRAFT 状态下删除变更请求")
    void shouldRejectDeleteWhenNotDraft() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-del-rej-" + UUID.randomUUID());
        ChangeRequest submitted = changeRequestRepository.save(
                buildChangeRequest(tenantId, "CHG-DEL-REJ-001", ChangeStatus.SUBMITTED,
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act + Assert
        assertThrows(BusinessException.class,
                () -> changeRequestService.deleteChangeRequest(tenantId, submitted.getId()));
    }

    // ── 查询 ──

    /**
     * 应该按多条件过滤查询变更请求列表
     */
    @Test
    @DisplayName("应该按多条件过滤查询变更请求列表")
    void shouldListChangeRequestsWithFilters() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-list-" + UUID.randomUUID());
        changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-LIST-D-1", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-LIST-D-2", ChangeStatus.DRAFT,
                ChangeType.REQUIREMENT_CHANGE, ChangePriority.MAJOR));
        changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-LIST-S-1", ChangeStatus.SUBMITTED,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act: 按 status=DRAFT 过滤
        ListChangeRequestsRequest draftRequest = new ListChangeRequestsRequest(
                null, ChangeStatus.DRAFT, null, null, null, 1, 10);
        Page<ChangeRequestDto> draftPage = changeRequestService.listChangeRequests(
                tenantId, draftRequest);

        // Assert
        assertAll(
                () -> assertEquals(2, draftPage.getTotalElements(), "DRAFT 应有 2 条"),
                () -> assertTrue(draftPage.getContent().stream()
                        .allMatch(d -> d.status() == ChangeStatus.DRAFT))
        );

        // Act: 按 type=REQUIREMENT_CHANGE 过滤
        ListChangeRequestsRequest reqRequest = new ListChangeRequestsRequest(
                null, null, ChangeType.REQUIREMENT_CHANGE, null, null, 1, 10);
        Page<ChangeRequestDto> reqPage = changeRequestService.listChangeRequests(
                tenantId, reqRequest);

        // Assert
        assertEquals(1, reqPage.getTotalElements(), "REQUIREMENT_CHANGE 应有 1 条");

        // Act: 按 keyword 过滤
        ListChangeRequestsRequest kwRequest = new ListChangeRequestsRequest(
                null, null, null, null, "LIST-S", 1, 10);
        Page<ChangeRequestDto> kwPage = changeRequestService.listChangeRequests(
                tenantId, kwRequest);

        // Assert
        assertEquals(1, kwPage.getTotalElements(), "keyword=LIST-S 应匹配 1 条");
    }

    /**
     * 应该按租户隔离查询：跨租户查询返回空
     */
    @Test
    @DisplayName("应该按租户隔离查询")
    void shouldEnforceTenantIsolationInList() {
        // Arrange
        UUID tenantA = createTestTenant("tenant-svc-iso-a-" + UUID.randomUUID());
        UUID tenantB = createTestTenant("tenant-svc-iso-b-" + UUID.randomUUID());
        changeRequestRepository.save(buildChangeRequest(
                tenantA, "CHG-ISO-A-001", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act: 用 tenantB 查询
        ListChangeRequestsRequest request = new ListChangeRequestsRequest(
                null, null, null, null, null, 1, 10);
        Page<ChangeRequestDto> page = changeRequestService.listChangeRequests(tenantB, request);

        // Assert
        assertEquals(0, page.getTotalElements(), "跨租户查询应返回空");
    }

    /**
     * 应该在查询不存在变更时抛 NOT_FOUND
     */
    @Test
    @DisplayName("应该在查询不存在变更时抛 NOT_FOUND")
    void shouldThrowNotFoundWhenQueryNotExist() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-404-" + UUID.randomUUID());
        UUID nonExistentId = UUID.randomUUID();

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.getChangeRequest(tenantId, nonExistentId));
        assertEquals(404, ex.getHttpStatus().value());
    }

    // ── 提交影响评估 ──

    /**
     * 应该在 SUBMITTED 状态下成功提交影响评估
     */
    @Test
    @DisplayName("应该在 SUBMITTED 状态下成功提交影响评估")
    void shouldSubmitImpactAssessmentInSubmittedStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-ia-" + UUID.randomUUID());
        ChangeRequest submitted = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-IA-001", ChangeStatus.SUBMITTED,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        SubmitImpactAssessmentRequest request = new SubmitImpactAssessmentRequest(
                "{\"summary\":\"已识别 3 个受影响图纸\"}", true, null);

        // Act
        ChangeRequestDto dto = changeRequestService.submitImpactAssessment(
                tenantId, submitted.getId(), "initiator@platform.local", null, request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.PENDING_APPROVAL, dto.status()),
                () -> assertTrue(dto.confirmedNoImpact()),
                () -> assertTrue(dto.riskAssessment().contains("已确认无影响"))
        );
    }

    /**
     * 应应该在 IMPACT_ASSESSMENT 状态下也可提交影响评估
     */
    @Test
    @DisplayName("应该在 IMPACT_ASSESSMENT 状态下也可提交影响评估")
    void shouldSubmitImpactAssessmentInImpactAssessmentStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-ia2-" + UUID.randomUUID());
        ChangeRequest inAssessment = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-IA-002", ChangeStatus.IMPACT_ASSESSMENT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        SubmitImpactAssessmentRequest request = new SubmitImpactAssessmentRequest(
                "{\"summary\":\"已分析完成\"}", false, null);

        // Act
        ChangeRequestDto dto = changeRequestService.submitImpactAssessment(
                tenantId, inAssessment.getId(), "initiator@platform.local", null, request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.PENDING_APPROVAL, dto.status()),
                () -> assertFalse(dto.confirmedNoImpact()),
                () -> assertTrue(dto.riskAssessment().contains("已确认存在影响"))
        );
    }

    /**
     * CRITICAL 优先级变更提交影响评估必须 stepUpToken
     */
    @Test
    @DisplayName("CRITICAL 优先级变更提交影响评估必须 stepUpToken")
    void shouldRequireStepUpTokenForCriticalPriorityImpactAssessment() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-crit-ia-" + UUID.randomUUID());
        ChangeRequest critical = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-CRIT-IA-001", ChangeStatus.SUBMITTED,
                ChangeType.DESIGN_CHANGE, ChangePriority.CRITICAL));
        SubmitImpactAssessmentRequest request = new SubmitImpactAssessmentRequest(
                "高风险影响分析", true, null); // stepUpToken 为 null

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.submitImpactAssessment(
                        tenantId, critical.getId(), "initiator@platform.local", null, request));
        assertEquals(400, ex.getHttpStatus().value());
        assertTrue(ex.getMessage().contains("stepUpToken"));
    }

    /**
     * CRITICAL 优先级变更提供 stepUpToken 后应成功提交影响评估
     */
    @Test
    @DisplayName("CRITICAL 优先级变更提供 stepUpToken 后应成功提交影响评估")
    void shouldSubmitCriticalImpactAssessmentWithStepUpToken() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-crit-ia-ok-" + UUID.randomUUID());
        ChangeRequest critical = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-CRIT-IA-OK", ChangeStatus.SUBMITTED,
                ChangeType.DESIGN_CHANGE, ChangePriority.CRITICAL));
        SubmitImpactAssessmentRequest request = new SubmitImpactAssessmentRequest(
                "{\"summary\":\"高风险影响已分析\"}", true, "valid-step-up-token");

        // Act
        ChangeRequestDto dto = changeRequestService.submitImpactAssessment(
                tenantId, critical.getId(), "initiator@platform.local", null, request);

        // Assert
        assertEquals(ChangeStatus.PENDING_APPROVAL, dto.status());
    }

    /**
     * 应该拒绝在非 SUBMITTED/IMPACT_ASSESSMENT 状态下提交影响评估
     */
    @Test
    @DisplayName("应该拒绝在非 SUBMITTED/IMPACT_ASSESSMENT 状态下提交影响评估")
    void shouldRejectImpactAssessmentInWrongStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-ia-wrong-" + UUID.randomUUID());
        ChangeRequest draft = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-IA-WRONG", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        SubmitImpactAssessmentRequest request = new SubmitImpactAssessmentRequest(
                "尝试在 DRAFT 状态提交", false, null);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.submitImpactAssessment(
                        tenantId, draft.getId(), "initiator@platform.local", null, request));
        assertEquals(409, ex.getHttpStatus().value()); // CONFLICT
    }

    // ── 批准 ──

    /**
     * 应该在 PENDING_APPROVAL 状态下成功批准变更（stepUpToken + 责任确认 + 职责分离满足）
     */
    @Test
    @DisplayName("应该在 PENDING_APPROVAL 状态下成功批准变更")
    void shouldApproveChangeRequestInPendingApprovalStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-appr-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-APPR-001", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        // initiatedBy 在 buildChangeRequest 中为 "initiator@platform.local"
        // 使用不同用户作为批准人
        ApproveChangeRequestRequest request = new ApproveChangeRequestRequest(
                "批准说明", "valid-step-up-token", true);

        // Act
        ChangeRequestDto dto = changeRequestService.approveChangeRequest(
                tenantId, pending.getId(), "approver@platform.local", request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.APPROVED, dto.status()),
                () -> assertEquals("approver@platform.local", dto.approvedBy()),
                () -> assertNotNull(dto.approvedAt())
        );
    }

    /**
     * 应该拒绝批准时缺少 stepUpToken
     */
    @Test
    @DisplayName("应该拒绝批准时缺少 stepUpToken")
    void shouldRejectApproveWithoutStepUpToken() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-appr-tok-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-APPR-TOK", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        ApproveChangeRequestRequest request = new ApproveChangeRequestRequest(
                "批准说明", null, true); // stepUpToken 为 null

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.approveChangeRequest(
                        tenantId, pending.getId(), "approver@platform.local", request));
        assertEquals(400, ex.getHttpStatus().value());
    }

    /**
     * 应该拒绝批准时未确认责任
     */
    @Test
    @DisplayName("应该拒绝批准时未确认责任")
    void shouldRejectApproveWithoutResponsibilityAcknowledged() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-appr-resp-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-APPR-RESP", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        ApproveChangeRequestRequest request = new ApproveChangeRequestRequest(
                "批准说明", "valid-step-up-token", false); // 责任确认为 false

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.approveChangeRequest(
                        tenantId, pending.getId(), "approver@platform.local", request));
        assertEquals(400, ex.getHttpStatus().value());
        assertTrue(ex.getMessage().contains("responsibilityAcknowledged"));
    }

    /**
     * 应该拒绝批准时批准人等于发起人（职责分离）
     */
    @Test
    @DisplayName("应该拒绝批准时批准人等于发起人（职责分离）")
    void shouldRejectApproveWhenApproverEqualsInitiator() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-appr-sod-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-APPR-SOD", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        // pending.initiatedBy = "initiator@platform.local"
        ApproveChangeRequestRequest request = new ApproveChangeRequestRequest(
                "尝试自己批准", "valid-step-up-token", true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.approveChangeRequest(
                        tenantId, pending.getId(),
                        "initiator@platform.local", // 同发起人
                        request));
        assertEquals(403, ex.getHttpStatus().value()); // FORBIDDEN
        assertTrue(ex.getMessage().contains("职责分离"));
    }

    /**
     * 应该拒绝在非 PENDING_APPROVAL 状态下批准
     */
    @Test
    @DisplayName("应该拒绝在非 PENDING_APPROVAL 状态下批准")
    void shouldRejectApproveInWrongStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-appr-wrong-" + UUID.randomUUID());
        ChangeRequest draft = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-APPR-WRONG", ChangeStatus.DRAFT,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        ApproveChangeRequestRequest request = new ApproveChangeRequestRequest(
                "尝试批准草稿", "valid-step-up-token", true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.approveChangeRequest(
                        tenantId, draft.getId(), "approver@platform.local", request));
        assertEquals(409, ex.getHttpStatus().value()); // CONFLICT
    }

    // ── 拒绝 ──

    /**
     * 应该在 PENDING_APPROVAL 状态下成功拒绝变更
     */
    @Test
    @DisplayName("应该在 PENDING_APPROVAL 状态下成功拒绝变更")
    void shouldRejectChangeRequestInPendingApprovalStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-rej-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-REJ-001", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        RejectChangeRequestRequest request = new RejectChangeRequestRequest(
                "理由不充分", "valid-step-up-token");

        // Act
        ChangeRequestDto dto = changeRequestService.rejectChangeRequest(
                tenantId, pending.getId(), "approver@platform.local", request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.REJECTED, dto.status()),
                () -> assertTrue(dto.riskAssessment().contains("拒绝原因"))
        );
    }

    /**
     * 应该拒绝拒绝操作时缺少 stepUpToken
     */
    @Test
    @DisplayName("应该拒绝拒绝操作时缺少 stepUpToken")
    void shouldRejectRejectWithoutStepUpToken() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-rej-tok-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-REJ-TOK", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        RejectChangeRequestRequest request = new RejectChangeRequestRequest(
                "拒绝原因", null);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.rejectChangeRequest(
                        tenantId, pending.getId(), "approver@platform.local", request));
        assertEquals(400, ex.getHttpStatus().value());
    }

    // ── 撤回 ──

    /**
     * 应该由发起人成功撤回变更
     */
    @Test
    @DisplayName("应该由发起人成功撤回变更")
    void shouldRecallByInitiator() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-recall-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-RECALL-001", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        // pending.initiatedBy = "initiator@platform.local"
        RecallChangeRequestRequest request = new RecallChangeRequestRequest(
                "信息错误需撤回", "valid-step-up-token");

        // Act
        ChangeRequestDto dto = changeRequestService.recallChangeRequest(
                tenantId, pending.getId(), "initiator@platform.local", request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.RECALLED, dto.status()),
                () -> assertTrue(dto.riskAssessment().contains("撤回原因"))
        );
    }

    /**
     * 应该拒绝非发起人撤回
     */
    @Test
    @DisplayName("应该拒绝非发起人撤回")
    void shouldRejectRecallByNonInitiator() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-recall-sod-" + UUID.randomUUID());
        ChangeRequest pending = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-RECALL-SOD", ChangeStatus.PENDING_APPROVAL,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        // pending.initiatedBy = "initiator@platform.local"
        RecallChangeRequestRequest request = new RecallChangeRequestRequest(
                "非发起人尝试撤回", "valid-step-up-token");

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.recallChangeRequest(
                        tenantId, pending.getId(),
                        "non-initiator@platform.local",
                        request));
        assertEquals(403, ex.getHttpStatus().value());
        assertTrue(ex.getMessage().contains("发起人"));
    }

    /**
     * 应该拒绝撤回已 CLOSED 的变更
     */
    @Test
    @DisplayName("应该拒绝撤回已 CLOSED 的变更")
    void shouldRejectRecallWhenClosed() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-recall-closed-" + UUID.randomUUID());
        ChangeRequest closed = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-RECALL-CLD", ChangeStatus.CLOSED,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        RecallChangeRequestRequest request = new RecallChangeRequestRequest(
                "尝试撤回已关闭", "valid-step-up-token");

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.recallChangeRequest(
                        tenantId, closed.getId(), "initiator@platform.local", request));
        assertEquals(409, ex.getHttpStatus().value());
    }

    // ── 验证关闭 ──

    /**
     * 应该在 PENDING_VERIFICATION 状态下成功关闭变更
     *
     * <p>构造 PENDING_VERIFICATION 状态实体，approvedBy 与 implementedBy 已设置，
     * 关闭人使用第三个用户，满足职责分离。
     */
    @Test
    @DisplayName("应该在 PENDING_VERIFICATION 状态下成功关闭变更")
    void shouldVerifyClosureInPendingVerificationStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-" + UUID.randomUUID());
        ChangeRequest pendingVerification = buildChangeRequest(
                tenantId, "CHG-CLOSE-001", ChangeStatus.PENDING_VERIFICATION,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
        pendingVerification.setApprovedBy("approver@platform.local");
        pendingVerification.setApprovedAt(Instant.now());
        pendingVerification.setImplementedBy("implementer@platform.local");
        pendingVerification.setImplementedAt(Instant.now());
        changeRequestRepository.save(pendingVerification);

        // 关闭人使用第三个用户
        VerifyClosureRequest request = new VerifyClosureRequest(
                "全部验证通过", "关闭备注", "valid-step-up-token", true);

        // Act
        ChangeRequestDto dto = changeRequestService.verifyClosure(
                tenantId, pendingVerification.getId(),
                "closer@platform.local", request);

        // Assert
        assertAll(
                () -> assertEquals(ChangeStatus.CLOSED, dto.status()),
                () -> assertEquals("closer@platform.local", dto.closedBy()),
                () -> assertNotNull(dto.closedAt()),
                () -> assertTrue(dto.riskAssessment().contains("关闭验证结果"))
        );
    }

    /**
     * 应该拒绝关闭时关闭人等于批准人（职责分离）
     */
    @Test
    @DisplayName("应该拒绝关闭时关闭人等于批准人（职责分离）")
    void shouldRejectCloseWhenCloserEqualsApprover() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-sod-a-" + UUID.randomUUID());
        ChangeRequest pendingVerification = buildChangeRequest(
                tenantId, "CHG-CLOSE-SOD-A", ChangeStatus.PENDING_VERIFICATION,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
        pendingVerification.setApprovedBy("approver@platform.local");
        pendingVerification.setApprovedAt(Instant.now());
        pendingVerification.setImplementedBy("implementer@platform.local");
        pendingVerification.setImplementedAt(Instant.now());
        changeRequestRepository.save(pendingVerification);

        VerifyClosureRequest request = new VerifyClosureRequest(
                "尝试批准人关闭", null, "valid-step-up-token", true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.verifyClosure(
                        tenantId, pendingVerification.getId(),
                        "approver@platform.local", // 同批准人
                        request));
        assertEquals(403, ex.getHttpStatus().value());
        assertTrue(ex.getMessage().contains("批准人"));
    }

    /**
     * 应应该拒绝关闭时关闭人等于实施人（职责分离）
     */
    @Test
    @DisplayName("应该拒绝关闭时关闭人等于实施人（职责分离）")
    void shouldRejectCloseWhenCloserEqualsImplementer() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-sod-b-" + UUID.randomUUID());
        ChangeRequest pendingVerification = buildChangeRequest(
                tenantId, "CHG-CLOSE-SOD-B", ChangeStatus.PENDING_VERIFICATION,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
        pendingVerification.setApprovedBy("approver@platform.local");
        pendingVerification.setApprovedAt(Instant.now());
        pendingVerification.setImplementedBy("implementer@platform.local");
        pendingVerification.setImplementedAt(Instant.now());
        changeRequestRepository.save(pendingVerification);

        VerifyClosureRequest request = new VerifyClosureRequest(
                "尝试实施人关闭", null, "valid-step-up-token", true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.verifyClosure(
                        tenantId, pendingVerification.getId(),
                        "implementer@platform.local", // 同实施人
                        request));
        assertEquals(403, ex.getHttpStatus().value());
        assertTrue(ex.getMessage().contains("实施人"));
    }

    /**
     * 应该拒绝关闭时缺少 stepUpToken
     */
    @Test
    @DisplayName("应该拒绝关闭时缺少 stepUpToken")
    void shouldRejectCloseWithoutStepUpToken() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-tok-" + UUID.randomUUID());
        ChangeRequest pendingVerification = buildChangeRequest(
                tenantId, "CHG-CLOSE-TOK", ChangeStatus.PENDING_VERIFICATION,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
        pendingVerification.setApprovedBy("approver@platform.local");
        pendingVerification.setApprovedAt(Instant.now());
        pendingVerification.setImplementedBy("implementer@platform.local");
        pendingVerification.setImplementedAt(Instant.now());
        changeRequestRepository.save(pendingVerification);

        VerifyClosureRequest request = new VerifyClosureRequest(
                "尝试无 token 关闭", null, null, true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.verifyClosure(
                        tenantId, pendingVerification.getId(),
                        "closer@platform.local", request));
        assertEquals(400, ex.getHttpStatus().value());
    }

    /**
     * 应该拒绝关闭时未确认责任
     */
    @Test
    @DisplayName("应该拒绝关闭时未确认责任")
    void shouldRejectCloseWithoutResponsibilityAcknowledged() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-resp-" + UUID.randomUUID());
        ChangeRequest pendingVerification = buildChangeRequest(
                tenantId, "CHG-CLOSE-RESP", ChangeStatus.PENDING_VERIFICATION,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL);
        pendingVerification.setApprovedBy("approver@platform.local");
        pendingVerification.setApprovedAt(Instant.now());
        pendingVerification.setImplementedBy("implementer@platform.local");
        pendingVerification.setImplementedAt(Instant.now());
        changeRequestRepository.save(pendingVerification);

        VerifyClosureRequest request = new VerifyClosureRequest(
                "尝试无责任确认关闭", null, "valid-step-up-token", false);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.verifyClosure(
                        tenantId, pendingVerification.getId(),
                        "closer@platform.local", request));
        assertEquals(400, ex.getHttpStatus().value());
    }

    /**
     * 应该拒绝在非 PENDING_VERIFICATION 状态下关闭
     */
    @Test
    @DisplayName("应该拒绝在非 PENDING_VERIFICATION 状态下关闭")
    void shouldRejectCloseInWrongStatus() {
        // Arrange
        UUID tenantId = createTestTenant("tenant-svc-close-wrong-" + UUID.randomUUID());
        ChangeRequest approved = changeRequestRepository.save(buildChangeRequest(
                tenantId, "CHG-CLOSE-WRONG", ChangeStatus.APPROVED,
                ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        VerifyClosureRequest request = new VerifyClosureRequest(
                "尝试批准状态关闭", null, "valid-step-up-token", true);

        // Act + Assert
        BusinessException ex = assertThrows(BusinessException.class,
                () -> changeRequestService.verifyClosure(
                        tenantId, approved.getId(),
                        "closer@platform.local", request));
        assertEquals(409, ex.getHttpStatus().value());
    }

    // ── 辅助方法 ──

    /**
     * 构造测试用 ChangeRequest（含发起人信息）
     */
    private ChangeRequest buildChangeRequest(
            UUID tenantId, String code, ChangeStatus status,
            ChangeType type, ChangePriority priority) {
        ChangeRequest request = new ChangeRequest();
        request.setTenantId(tenantId);
        request.setCode(code);
        request.setTitle("测试变更：" + code);
        request.setDescription("Service IT 自动创建的变更请求 " + code);
        request.setType(type);
        request.setPriority(priority);
        request.setStatus(status);
        request.setProjectId("PROJ-TEST");
        request.setInitiatedBy("initiator@platform.local");
        request.setInitiatedAt(Instant.now());
        request.setImpactAssessment("{}");
        request.setAiAssistedAnalysis("{}");
        request.setConfirmedNoImpact(false);
        request.setAiAssisted(false);
        return request;
    }
}
