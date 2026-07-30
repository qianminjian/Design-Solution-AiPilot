package com.platform.core.change.request.service;

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
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
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

    public ChangeRequestService(ChangeRequestRepository repository) {
        this.repository = repository;
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

    @Transactional
    public ChangeRequestDto submitImpactAssessment(
            UUID tenantId,
            UUID id,
            String currentUser,
            SubmitImpactAssessmentRequest request
    ) {
        ChangeRequest entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ChangeRequest not found: " + id));

        if (entity.getStatus() != ChangeStatus.SUBMITTED
                && entity.getStatus() != ChangeStatus.IMPACT_ASSESSMENT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 SUBMITTED 或 IMPACT_ASSESSMENT 状态才能提交影响评估，当前状态: "
                            + entity.getStatus());
        }

        // 高风险变更强制 stepUpToken
        if (entity.getPriority() == ChangePriority.CRITICAL) {
            validateStepUpToken(request.stepUpToken());
        }

        entity.setImpactAssessment(request.impactAssessment());
        entity.setConfirmedNoImpact(request.confirmedNoImpact());
        entity.setStatus(ChangeStatus.PENDING_APPROVAL);
        entity.setRiskAssessment(updateRiskAssessment(entity, request));

        ChangeRequest saved = repository.save(entity);
        log.info("ChangeRequest impact assessment submitted: id={}, tenantId={}, confirmedNoImpact={}",
                id, tenantId, request.confirmedNoImpact());
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

        if (entity.getStatus() != ChangeStatus.PENDING_VERIFICATION) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "ChangeRequest 必须在 PENDING_VERIFICATION 状态才能验证关闭，当前状态: "
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

        // V0 简化：跳过 Unknown 影响项检查、所有任务完成检查、所有证据已验证检查
        // V1 完整实现：调用 AffectedItemService/TaskPlanService/ClosureEvidenceService 校验

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

    // ── 辅助方法 ──

    /** 生成业务编号（如 CHG-2026-<6位UUID后缀>） */
    private String generateCode() {
        String uuidSuffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "CHG-" + Year.now().getValue() + "-" + uuidSuffix;
    }

    /** 校验 stepUpToken（V0 简化：仅非空校验） */
    private void validateStepUpToken(String stepUpToken) {
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "高风险操作需要 stepUpToken 二次认证");
        }
        // V1 完整实现：调用 IAM step-up 服务校验 token 有效性与 scope
    }

    /** 追加风险说明 */
    private String updateRiskAssessment(ChangeRequest entity, SubmitImpactAssessmentRequest request) {
        String existing = entity.getRiskAssessment() == null ? "" : entity.getRiskAssessment();
        String suffix = request.confirmedNoImpact() ? "（已确认无影响）" : "（已确认存在影响）";
        return existing + (existing.isEmpty() ? "" : " | ") + suffix;
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
                entity.isConfirmedNoImpact(),
                entity.isAiAssisted(),
                entity.getRiskAssessment(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
