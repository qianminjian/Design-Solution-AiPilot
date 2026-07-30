package com.platform.core.analysis.problem.service;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;
import com.platform.core.analysis.problem.domain.AnalysisProblem;
import com.platform.core.analysis.problem.dto.AnalysisProblemDto;
import com.platform.core.analysis.problem.dto.CreateAnalysisProblemRequest;
import com.platform.core.analysis.problem.dto.InvalidateProblemRequest;
import com.platform.core.analysis.problem.dto.ListAnalysisProblemsRequest;
import com.platform.core.analysis.problem.repository.AnalysisProblemRepository;
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
import java.util.UUID;

/**
 * 工程分析问题服务（D37.14 P10）
 *
 * 核心操作：
 *  - listProblems：按租户/项目/状态/类型/关键字查询
 *  - getProblem：单条详情
 *  - createProblem：创建草稿
 *  - updateProblem：更新草稿（仅 DRAFT 状态）
 *  - deleteProblem：删除草稿
 *  - submitProblem：提交就绪（DRAFT → READY）
 *  - invalidateProblem：标记失效（任意状态 → INVALID）
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - submit/invalidate 为高风险动作，需 stepUpToken 二次认证
 *  - AI 辅助标记须人工确认（requiresHumanReview）
 *  - 完成运行 ≠ 接受结果
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Service
public class AnalysisProblemService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisProblemService.class);

    private final AnalysisProblemRepository repository;

    public AnalysisProblemService(AnalysisProblemRepository repository) {
        this.repository = repository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public Page<AnalysisProblemDto> listProblems(UUID tenantId, ListAnalysisProblemsRequest request) {
        int page = request.page() != null && request.page() > 0 ? request.page() - 1 : 0;
        int size = request.pageSize() != null && request.pageSize() > 0 ? request.pageSize() : 20;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<AnalysisProblem> spec = (root, query, cb) ->
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
    public AnalysisProblemDto getProblem(UUID tenantId, UUID id) {
        AnalysisProblem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisProblem not found: " + id));
        return toDto(entity);
    }

    // ── 创建/更新/删除 ──

    @Transactional
    public AnalysisProblemDto createProblem(
            UUID tenantId,
            String currentUser,
            CreateAnalysisProblemRequest request
    ) {
        AnalysisProblem entity = new AnalysisProblem();
        entity.setTenantId(tenantId);
        entity.setCode(generateCode());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setType(request.type());
        entity.setStatus(ProblemStatus.DRAFT);
        entity.setProjectId(request.projectId());
        entity.setProjectName(request.projectName());
        entity.setBaselineId(request.baselineId());
        entity.setBaselineHash(request.baselineHash());
        entity.setOwner(currentUser);
        entity.setOwnerRole(request.ownerRole() != null ? request.ownerRole() : "ANALYST");
        entity.setInputCompleteness(request.inputCompleteness() != null ? request.inputCompleteness() : 0);
        entity.setAssumptionCount(request.assumptionCount() != null ? request.assumptionCount() : 0);
        entity.setBoundaryConditionCount(request.boundaryConditionCount() != null
                ? request.boundaryConditionCount() : 0);
        entity.setLoadCaseCount(request.loadCaseCount() != null ? request.loadCaseCount() : 0);
        entity.setRunCount(0);
        entity.setRequiresHumanReview(false);
        entity.setAiAssisted(false);

        AnalysisProblem saved = repository.save(entity);
        log.info("AnalysisProblem created: id={}, code={}, tenantId={}, owner={}",
                saved.getId(), saved.getCode(), tenantId, currentUser);
        return toDto(saved);
    }

    @Transactional
    public AnalysisProblemDto updateProblem(
            UUID tenantId,
            UUID id,
            CreateAnalysisProblemRequest request
    ) {
        AnalysisProblem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisProblem not found: " + id));

        if (entity.getStatus() != ProblemStatus.DRAFT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "AnalysisProblem 只能在 DRAFT 状态下编辑，当前状态: " + entity.getStatus());
        }

        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setType(request.type());
        entity.setProjectId(request.projectId());
        entity.setProjectName(request.projectName());
        entity.setBaselineId(request.baselineId());
        entity.setBaselineHash(request.baselineHash());
        if (request.ownerRole() != null) {
            entity.setOwnerRole(request.ownerRole());
        }
        if (request.inputCompleteness() != null) {
            entity.setInputCompleteness(request.inputCompleteness());
        }
        if (request.assumptionCount() != null) {
            entity.setAssumptionCount(request.assumptionCount());
        }
        if (request.boundaryConditionCount() != null) {
            entity.setBoundaryConditionCount(request.boundaryConditionCount());
        }
        if (request.loadCaseCount() != null) {
            entity.setLoadCaseCount(request.loadCaseCount());
        }

        AnalysisProblem saved = repository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void deleteProblem(UUID tenantId, UUID id) {
        AnalysisProblem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisProblem not found: " + id));

        if (entity.getStatus() != ProblemStatus.DRAFT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "AnalysisProblem 只能在 DRAFT 状态下删除，当前状态: " + entity.getStatus());
        }

        repository.delete(entity);
        log.info("AnalysisProblem deleted: id={}, tenantId={}", id, tenantId);
    }

    // ── 状态流转：提交就绪 ──

    @Transactional
    public AnalysisProblemDto submitProblem(UUID tenantId, UUID id, String currentUser) {
        AnalysisProblem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisProblem not found: " + id));

        if (entity.getStatus() != ProblemStatus.DRAFT) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "AnalysisProblem 必须在 DRAFT 状态才能提交，当前状态: " + entity.getStatus());
        }

        // 输入完整性校验（V0 简化：≥80% 视为就绪）
        if (entity.getInputCompleteness() < 80) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "输入完整性不足，当前: " + entity.getInputCompleteness() + "%，需 ≥80%");
        }

        entity.setStatus(ProblemStatus.READY);
        entity.setSubmittedAt(Instant.now());

        AnalysisProblem saved = repository.save(entity);
        log.info("AnalysisProblem submitted: id={}, tenantId={}, submittedBy={}",
                id, tenantId, currentUser);
        return toDto(saved);
    }

    // ── 状态流转：标记失效 ──

    @Transactional
    public AnalysisProblemDto invalidateProblem(
            UUID tenantId,
            UUID id,
            String currentUser,
            InvalidateProblemRequest request
    ) {
        AnalysisProblem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisProblem not found: " + id));

        if (entity.getStatus() == ProblemStatus.INVALID) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "AnalysisProblem 已处于 INVALID 状态");
        }

        // 高风险动作强制 stepUpToken（V0 占位校验：非空即通过，V1 接入正式 Step-up 认证）
        validateStepUpToken(request.stepUpToken());

        entity.setStatus(ProblemStatus.INVALID);
        entity.setInvalidatedAt(Instant.now());
        entity.setInvalidationReason(request.reason());

        AnalysisProblem saved = repository.save(entity);
        log.info("AnalysisProblem invalidated: id={}, tenantId={}, invalidatedBy={}, reason={}",
                id, tenantId, currentUser, request.reason());
        return toDto(saved);
    }

    // ── 辅助方法 ──

    /**
     * 提取当前操作用户：从 x-user-id 请求头读取
     */
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

    /**
     * 校验 Step-up Token（V0 占位：非空即通过，V1 接入正式 Step-up 认证服务）
     */
    private void validateStepUpToken(String stepUpToken) {
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "高风险动作必须提供 stepUpToken");
        }
    }

    /**
     * 生成业务编号：AN-yyyy-NNNNN
     */
    private String generateCode() {
        return "AN-" + java.time.Year.now().getValue() + "-"
                + String.format("%05d", System.nanoTime() % 100000);
    }

    // ── 实体 → DTO ──

    public AnalysisProblemDto toDto(AnalysisProblem entity) {
        return new AnalysisProblemDto(
                entity.getId(),
                entity.getCode(),
                entity.getTitle(),
                entity.getType(),
                entity.getStatus(),
                entity.getDescription(),
                entity.getProjectId(),
                entity.getProjectName(),
                entity.getBaselineId(),
                entity.getBaselineHash(),
                entity.getOwner(),
                entity.getOwnerRole(),
                entity.getInputCompleteness(),
                entity.getAssumptionCount(),
                entity.getBoundaryConditionCount(),
                entity.getLoadCaseCount(),
                entity.getRunCount(),
                entity.getLatestRunId(),
                entity.getLatestRunStatus(),
                entity.getLatestResultQuality(),
                entity.isRequiresHumanReview(),
                entity.isAiAssisted(),
                entity.getSubmittedAt(),
                entity.getInvalidatedAt(),
                entity.getInvalidationReason(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
