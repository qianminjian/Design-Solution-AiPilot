package com.platform.core.change.request.service;

import com.platform.core.common.spi.StepUpTokenValidator;
import com.platform.core.change.affecteditem.service.AffectedItemService;
import com.platform.core.change.closureevidence.service.ClosureEvidenceService;
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
import com.platform.core.change.taskplan.service.TaskPlanItemService;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.Year;
import java.util.Map;
import java.util.UUID;

/**
 * 变更请求服务（D37.16 P12 变更影响与闭环工作台）
 *
 * 核心操作：
 *  - listChangeRequests：按租户/项目/状态/类型/优先级/关键字查询
 *  - getChangeRequest：单条详情（含子实体）
 *  - createChangeRequest：创建草稿
 *  - updateChangeRequest：更新草稿（仅 DRAFT 状态）
 *  - deleteChangeRequest：删除草稿
 *  - submitImpactAssessment：提交影响评估
 *  - approveChangeRequest：批准变更
 *  - rejectChangeRequest：拒绝变更
 *  - recallChangeRequest：撤回变更
 *  - verifyClosure：验证关闭
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险变更（CRITICAL 优先级）强制 stepUpToken 二次认证
 *  - 批准人 ≠ 实施人 ≠ 关闭人（职责分离）
 *  - AI 辅助影响分析结果须人工确认
 *  - 关闭证据须可验证
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Service
public class ChangeRequestService {

    private static final Logger log = LoggerFactory.getLogger(ChangeRequestService.class);

    private final ChangeRequestRepository repository;
    private final ObjectMapper objectMapper;
    /**
     * A-61 P1-3 修复：依赖倒置，change 域通过 StepUpTokenValidator 端口接口
     * 解除对 auth 域 JwtTokenProvider 的直接依赖。
     */
    private final StepUpTokenValidator stepUpTokenValidator;
    private final AiImpactAnalyzer aiImpactAnalyzer;
    /**
     * A-61 P0-3 修复：注入变更闭环校验三件套
     * - AffectedItemService：校验影响项无 UNKNOWN + 无 PENDING/IN_PROGRESS 复查
     * - TaskPlanItemService：校验处置任务无 PENDING/IN_PROGRESS/BLOCKED（blocksClosure=true）
     * - ClosureEvidenceService：校验关闭证据无 PENDING（blocksClosure=true）+ 无 REJECTED
     */
    private final AffectedItemService affectedItemService;
    private final TaskPlanItemService taskPlanItemService;
    private final ClosureEvidenceService closureEvidenceService;

    public ChangeRequestService(
            ChangeRequestRepository repository,
            ObjectMapper objectMapper,
            StepUpTokenValidator stepUpTokenValidator,
            AiImpactAnalyzer aiImpactAnalyzer,
            AffectedItemService affectedItemService,
            TaskPlanItemService taskPlanItemService,
            ClosureEvidenceService closureEvidenceService
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.stepUpTokenValidator = stepUpTokenValidator;
        this.aiImpactAnalyzer = aiImpactAnalyzer;
        this.affectedItemService = affectedItemService;
        this.taskPlanItemService = taskPlanItemService;
        this.closureEvidenceService = closureEvidenceService;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public Page<ChangeRequestDto> listChangeRequests(
            UUID tenantId,
            ListChangeRequestsRequest request
    ) {
        int page = request.page() != null && request.page() > 0 ? request.page() - 1 : 0;
        int size = request.pageSize() != null && request.pageSize() > 0 ? request.pageSize() : 20;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<ChangeRequest> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);

        if (request.projectId() != null && !request.projectId().isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("projectId"), request.projectId()));
        }
        if (request.status() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), request.status()));
        }
        if (request.type() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("type"), request.type()));
        }
        if (request.priority() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("priority"), request.priority()));
        }
        if (request.keyword() != null && !request.keyword().isBlank()) {
            String pattern = "%" + request.keyword().toLowerCase() + "%";
            spec = spec.and((root, query, cb) ->
                    cb.or(
                            cb.like(cb.lower(root.get("title")), pattern),
                            cb.like(cb.lower(root.get("code")), pattern)
                    ));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public ChangeRequestDto getChangeRequest(UUID tenantId, UUID id) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));
        return toDto(entity);
    }

    // ── 创建/更新/删除 ──

    @Transactional
    public ChangeRequestDto createChangeRequest(
            UUID tenantId,
            String currentUser,
            CreateChangeRequestRequest request
    ) {
        ChangeRequest entity = new ChangeRequest();
        entity.setTenantId(tenantId);
        entity.setCode(generateCode());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setType(request.type());
        entity.setPriority(request.priority());
        entity.setStatus(ChangeStatus.DRAFT);
        entity.setProjectId(request.projectId());
        entity.setBaselineId(request.baselineId());
        entity.setInitiatedBy(currentUser);
        entity.setInitiatedAt(Instant.now());
        entity.setConfirmedNoImpact(false);
        entity.setAiAssisted(false);
        entity.setRiskAssessment(request.riskAssessment());

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest created: id={}, code={}, tenantId={}, initiatedBy={}",
                saved.getId(), saved.getCode(), tenantId, currentUser);
        return toDto(saved);
    }

    @Transactional
    public ChangeRequestDto updateChangeRequest(
            UUID tenantId,
            UUID id,
            CreateChangeRequestRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        if (entity.getStatus() != ChangeStatus.DRAFT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 只能在 DRAFT 状态下编辑，当前状态: " + entity.getStatus());
        }

        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setType(request.type());
        entity.setPriority(request.priority());
        entity.setProjectId(request.projectId());
        entity.setBaselineId(request.baselineId());
        entity.setRiskAssessment(request.riskAssessment());

        ChangeRequest saved = repository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void deleteChangeRequest(UUID tenantId, UUID id) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        if (entity.getStatus() != ChangeStatus.DRAFT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 只能在 DRAFT 状态下删除，当前状态: " + entity.getStatus());
        }

        repository.delete(entity);
        log.info("ChangeRequest deleted: id={}, tenantId={}", id, tenantId);
    }

    // ── 状态流转：提交影响评估 ──

    /**
     * 提交影响评估（Sprint V1.8 集成 AI 辅助影响分析）
     *
     * <p>流程：
     * <ol>
     *   <li>状态机校验（DRAFT / SUBMITTED / IMPACT_ASSESSMENT → PENDING_APPROVAL）</li>
     *   <li>高风险变更（CRITICAL）强制 stepUpToken 二次认证</li>
     *   <li>保存用户手动输入的 impactAssessment</li>
     *   <li>调用 {@link AiImpactAnalyzer#generateImpactAnalysis} 生成 AI 辅助分析</li>
     *   <li>填充 aiAssistedAnalysis + isAiAssisted 字段（AI 失败时降级，不阻断主流程）</li>
     * </ol>
     *
     * <p>安全红线：AI 输出 requiresHumanReview=true，必须经人工复核后才可作为最终判断依据。
     *
     * @design D37-关键界面-交互状态.md §D37.16
     * @design security.md §12 AI 安全红线
     */
    @Transactional
    public ChangeRequestDto submitImpactAssessment(
            UUID tenantId,
            UUID id,
            String currentUser,
            String traceId,
            SubmitImpactAssessmentRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        // 前端契约：DRAFT/IMPACT_ASSESSMENT → PENDING_APPROVAL（@design-platform/shared §ChangeApiPaths）
        if (entity.getStatus() != ChangeStatus.DRAFT
                && entity.getStatus() != ChangeStatus.SUBMITTED
                && entity.getStatus() != ChangeStatus.IMPACT_ASSESSMENT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 DRAFT / SUBMITTED / IMPACT_ASSESSMENT 状态才能提交影响评估，当前状态: "
                            + entity.getStatus());
        }

        // 高风险变更强制 stepUpToken
        if (entity.getPriority() == ChangePriority.CRITICAL) {
            validateStepUpToken(request.stepUpToken());
        }

        // 将文本包装为 JSON 格式存储（impact_assessment 字段为 jsonb 类型）
        entity.setImpactAssessment(wrapAsJson(request.impactAssessment()));
        entity.setConfirmedNoImpact(request.confirmedNoImpact());
        entity.setStatus(ChangeStatus.PENDING_APPROVAL);
        entity.setRiskAssessment(updateRiskAssessment(entity, request));

        // Sprint V1.8：调用 AI 辅助影响分析（失败降级，不阻断主流程）
        try {
            AiImpactAnalyzer.AnalysisResult aiResult = aiImpactAnalyzer.generateImpactAnalysis(entity, traceId);
            entity.setAiAssistedAnalysis(aiResult.payload());
            entity.setAiAssisted(aiResult.aiAssisted());
            log.info("AI 影响分析已填充: changeId={}, aiAssisted={}, degraded={}, traceId={}",
                    id, aiResult.aiAssisted(), aiResult.degradeReason() != null, traceId);
        } catch (Exception ex) {
            // 兜底保护：AiImpactAnalyzer 内部已降级，此处仍 catch 防止意外异常影响主流程
            log.warn("AI 影响分析异常，保留手动输入: changeId={}, error={}", id, ex.getMessage());
            entity.setAiAssisted(false);
            entity.setAiAssistedAnalysis("{}");
        }

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest impact assessment submitted: id={}, tenantId={}, confirmedNoImpact={}, aiAssisted={}",
                id, tenantId, request.confirmedNoImpact(), saved.isAiAssisted());
        return toDto(saved);
    }

    // ── 状态流转：批准 ──

    @Transactional
    public ChangeRequestDto approveChangeRequest(
            UUID tenantId,
            UUID id,
            String currentUser,
            ApproveChangeRequestRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        if (entity.getStatus() != ChangeStatus.PENDING_APPROVAL) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 PENDING_APPROVAL 状态才能批准，当前状态: " + entity.getStatus());
        }

        // 责任确认必须明确
        if (!request.responsibilityAcknowledged()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "批准变更必须责任确认（responsibilityAcknowledged = true）");
        }

        // 强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        // 职责分离：批准人 ≠ 发起人
        if (currentUser.equals(entity.getInitiatedBy())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.FORBIDDEN,
                    "批准人不可兼任发起人（职责分离原则）");
        }

        entity.setStatus(ChangeStatus.APPROVED);
        entity.setApprovedBy(currentUser);
        entity.setApprovedAt(Instant.now());

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest approved: id={}, tenantId={}, approvedBy={}",
                id, tenantId, currentUser);
        return toDto(saved);
    }

    // ── 状态流转：拒绝 ──

    @Transactional
    public ChangeRequestDto rejectChangeRequest(
            UUID tenantId,
            UUID id,
            String currentUser,
            RejectChangeRequestRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        if (entity.getStatus() != ChangeStatus.PENDING_APPROVAL) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 PENDING_APPROVAL 状态才能拒绝，当前状态: " + entity.getStatus());
        }

        validateStepUpToken(request.stepUpToken());

        entity.setStatus(ChangeStatus.REJECTED);
        entity.setRiskAssessment(
                appendNote(entity.getRiskAssessment(), "拒绝原因: " + request.reason()));

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest rejected: id={}, tenantId={}, rejectedBy={}, reason={}",
                id, tenantId, currentUser, request.reason());
        return toDto(saved);
    }

    // ── 状态流转：撤回 ──

    @Transactional
    public ChangeRequestDto recallChangeRequest(
            UUID tenantId,
            UUID id,
            String currentUser,
            RecallChangeRequestRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        // 已 CLOSED 的不可撤回
        if (entity.getStatus() == ChangeStatus.CLOSED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 已 CLOSED，不可撤回");
        }

        // 仅发起人可撤回
        if (!currentUser.equals(entity.getInitiatedBy())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.FORBIDDEN,
                    "仅发起人可撤回变更请求");
        }

        validateStepUpToken(request.stepUpToken());

        entity.setStatus(ChangeStatus.RECALLED);
        entity.setRiskAssessment(
                appendNote(entity.getRiskAssessment(), "撤回原因: " + request.reason()));

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest recalled: id={}, tenantId={}, recalledBy={}, reason={}",
                id, tenantId, currentUser, request.reason());
        return toDto(saved);
    }

    // ── 状态流转：验证关闭 ──

    @Transactional
    public ChangeRequestDto verifyClosure(
            UUID tenantId,
            UUID id,
            String currentUser,
            VerifyClosureRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        // 前端契约：IN_PROGRESS/PENDING_VERIFICATION → CLOSED（@design-platform/shared §ChangeApiPaths §verifyClosure）
        // V0 简化：允许 IN_PROGRESS 直接进入 CLOSED（跳过 PENDING_VERIFICATION 中间状态）
        if (entity.getStatus() != ChangeStatus.PENDING_VERIFICATION
                && entity.getStatus() != ChangeStatus.IN_PROGRESS) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 PENDING_VERIFICATION 或 IN_PROGRESS 状态才能验证关闭，当前状态: "
                            + entity.getStatus());
        }

        // 责任确认必须明确
        if (!request.responsibilityAcknowledged()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "关闭变更必须责任确认（responsibilityAcknowledged = true）");
        }

        // 强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        // 职责分离：关闭人 ≠ 批准人 ≠ 实施人
        if (currentUser.equals(entity.getApprovedBy())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.FORBIDDEN,
                    "关闭人不可兼任批准人（职责分离原则）");
        }
        if (currentUser.equals(entity.getImplementedBy())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.FORBIDDEN,
                    "关闭人不可兼任实施人（职责分离原则）");
        }

        // A-61 P0-3 修复：变更关闭闭环校验（D11 变更管理红线）
        // 1. 影响项校验：无 UNKNOWN 影响项 + 无 PENDING/IN_PROGRESS 复查
        validateAffectedItemsBeforeClosure(tenantId, id);
        // 2. 处置任务校验：无 PENDING/IN_PROGRESS/BLOCKED 阻塞任务
        validateTaskPlanBeforeClosure(tenantId, id);
        // 3. 关闭证据校验：无 PENDING 阻塞证据 + 无 REJECTED 证据
        validateClosureEvidenceBeforeClosure(tenantId, id);

        entity.setStatus(ChangeStatus.CLOSED);
        entity.setClosedBy(currentUser);
        entity.setClosedAt(Instant.now());
        entity.setRiskAssessment(
                appendNote(entity.getRiskAssessment(), "关闭验证结果: " + request.verificationResult()));

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest closed: id={}, tenantId={}, closedBy={}",
                id, tenantId, currentUser);
        return toDto(saved);
    }

    // ── 变更关闭闭环校验（A-61 P0-3 修复，对齐 D11 变更管理红线） ──

    /**
     * 校验影响项：无 UNKNOWN 影响项 + 无 PENDING/IN_PROGRESS 复查
     *
     * <p>对齐 @design/D11-变更管理.md §关闭校验：
     * <ul>
     *   <li>UNKNOWN 影响项表示影响分析未完成，禁止关闭</li>
     *   <li>PENDING/IN_PROGRESS 复查项表示待复查流程未结束，禁止关闭</li>
     * </ul>
     */
    private void validateAffectedItemsBeforeClosure(UUID tenantId, UUID changeId) {
        long unknownCount = affectedItemService.countUnknownImpact(tenantId, changeId);
        if (unknownCount > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + unknownCount + " 个 UNKNOWN 影响项未完成影响分析");
        }
        long pendingRecheck = affectedItemService.countPendingRecheck(tenantId, changeId);
        if (pendingRecheck > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + pendingRecheck + " 个待复查影响项未完成复查流程");
        }
        long inProgressRecheck = affectedItemService.countInProgressRecheck(tenantId, changeId);
        if (inProgressRecheck > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + inProgressRecheck + " 个复查中影响项未完成复查流程");
        }
    }

    /**
     * 校验处置任务：无 PENDING/IN_PROGRESS/BLOCKED 阻塞任务
     *
     * <p>对齐 @design/D11-变更管理.md §关闭校验：
     * blocksClosure=true 的任务必须 COMPLETED 或 SKIPPED（含审批记录）。
     * TaskPlanItemService.countBlockingTasks 已聚合 PENDING/IN_PROGRESS/BLOCKED 三态。
     */
    private void validateTaskPlanBeforeClosure(UUID tenantId, UUID changeId) {
        long blockingTasks = taskPlanItemService.countBlockingTasks(tenantId, changeId);
        if (blockingTasks > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + blockingTasks + " 个未完成的阻塞任务（PENDING/IN_PROGRESS/BLOCKED）");
        }
    }

    /**
     * 校验关闭证据：无 PENDING 阻塞证据 + 无 REJECTED 证据
     *
     * <p>对齐 @design/D11-变更管理.md §关闭校验：
     * <ul>
     *   <li>blocksClosure=true 的证据必须 VERIFIED 或 REJECTED（已处理）</li>
     *   <li>存在 REJECTED 证据表示变更未通过验证，禁止关闭</li>
     * </ul>
     */
    private void validateClosureEvidenceBeforeClosure(UUID tenantId, UUID changeId) {
        long rejectedEvidence = closureEvidenceService.countRejected(tenantId, changeId);
        if (rejectedEvidence > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + rejectedEvidence + " 个 REJECTED 关闭证据，变更未通过验证");
        }
        long blockingEvidence = closureEvidenceService.countBlockingEvidence(tenantId, changeId);
        if (blockingEvidence > 0) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "变更关闭失败：存在 " + blockingEvidence + " 个未验证的阻塞证据（PENDING 状态）");
        }
    }

    // ── 辅助方法 ──

    /** 生成业务编号（如 CHG-2026-<6位UUID后缀>） */
    private String generateCode() {
        String uuidSuffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CHG-" + Year.now().getValue() + "-" + uuidSuffix;
    }

    /**
     * 校验 stepUpToken（V1.7 升级：真实 JWT 校验，对齐 Operations 域）
     *
     * <p>A-61 P1-3 修复：通过 {@link StepUpTokenValidator} 端口接口调用，
     * 由 auth 域 JwtTokenProvider 适配器实现，解除 change → auth 反向依赖。
     *
     * <p>校验内容：
     * <ul>
     *   <li>JWT 签名（HS256）+ 有效期（默认 5 分钟）</li>
     *   <li>token 类型必须为 TYPE_STEP_UP（"step_up"）</li>
     * </ul>
     *
     * <p>错误处理：适配器内部已统一转换为
     * {@link ErrorCode#STEP_UP_TOKEN_INVALID}（4015）防枚举攻击，
     * 本方法仅需捕获 BusinessException 透传。
     *
     * <p>注意：当前实现不绑定 purpose 与具体 actionType，允许同一 token 在 5 分钟内用于多个高风险动作。
     * V2 可考虑绑定 purpose 增强安全性。
     *
     * @design D40-信息-物理安全.md §Step-up 认证
     * @design security.md §2.2 认证 Token + §12 AI 安全红线
     */
    private void validateStepUpToken(String stepUpToken) {
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "高风险操作需要 stepUpToken 二次认证");
        }
        // V1.7 真实 JWT 校验：签名 + 有效期 + 类型（对齐 OperationsActionService.validateRiskConstraints）
        stepUpTokenValidator.validateStepUpToken(stepUpToken);
    }

    /** 追加风险说明 */
    private String updateRiskAssessment(ChangeRequest entity, SubmitImpactAssessmentRequest request) {
        String existing = entity.getRiskAssessment() == null ? "" : entity.getRiskAssessment();
        String suffix = request.confirmedNoImpact() ? "（已确认无影响）" : "（已确认存在影响）";
        return existing + (existing.isEmpty() ? "" : " | ") + suffix;
    }

    /**
     * 将文本包装为 JSON 对象存储（jsonb 字段需要合法 JSON 格式）
     *
     * <p>格式：{@code {"summary":"<文本内容>"}}
     * 如果文本为 null 或空，返回 {@code "{}"}。
     */
    private String wrapAsJson(String text) {
        if (text == null || text.isBlank()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(Map.of("summary", text));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize impactAssessment as JSON, fallback to empty object", e);
            return "{}";
        }
    }

    /** 追加备注 */
    private String appendNote(String existing, String note) {
        if (existing == null || existing.isBlank()) {
            return note;
        }
        return existing + " | " + note;
    }

    /** 提取当前用户 ID（从 HttpServletRequest 的 x-user-id header） */
    public String extractCurrentUser(HttpServletRequest request) {
        String userId = request.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED,
                    "缺少 x-user-id 请求头");
        }
        return userId;
    }

    // ── 实体 → DTO ──

    public ChangeRequestDto toDto(ChangeRequest entity) {
        return new ChangeRequestDto(
                entity.getId(),
                entity.getCode(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getType(),
                entity.getPriority(),
                entity.getStatus(),
                entity.getProjectId(),
                entity.getBaselineId(),
                entity.getInitiatedBy(),
                entity.getInitiatedAt(),
                entity.getApprovedBy(),
                entity.getApprovedAt(),
                entity.getImplementedBy(),
                entity.getImplementedAt(),
                entity.getClosedBy(),
                entity.getClosedAt(),
                entity.getImpactAssessment(),
                entity.isConfirmedNoImpact(),
                entity.getAiAssistedAnalysis(),
                entity.isAiAssisted(),
                entity.getRiskAssessment(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
