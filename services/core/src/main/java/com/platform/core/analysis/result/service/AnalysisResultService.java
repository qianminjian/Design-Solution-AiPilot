package com.platform.core.analysis.result.service;

import com.platform.core.analysis.domain.enums.QualityDecision;
import com.platform.core.analysis.domain.enums.ResultQualityStatus;
import com.platform.core.analysis.result.domain.AnalysisResult;
import com.platform.core.analysis.result.domain.ResultQualityAssessment;
import com.platform.core.analysis.result.dto.AnalysisResultDto;
import com.platform.core.analysis.result.dto.ImpactProposalRequest;
import com.platform.core.analysis.result.dto.ResultQualityAssessmentDto;
import com.platform.core.analysis.result.dto.SubmitQualityAssessmentRequest;
import com.platform.core.analysis.result.repository.AnalysisResultRepository;
import com.platform.core.analysis.result.repository.ResultQualityAssessmentRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 分析结果服务（D37.14 P10）
 *
 * <p>核心操作：
 *  - getResult：结果详情
 *  - getResultsByRun：按运行查询结果列表
 *  - getQualityAssessment：质量评估详情
 *  - submitQualityAssessment：提交质量评估
 *  - createImpactProposal：创建变更影响提案（结果 → 变更域）
 *  - supersedeResult：标记结果被取代
 *
 * 安全红线：
 *  - 决策 ACCEPT_AS_REVISION/EXCEPTION 需注册师签章（requiresSeal=true, sealId 非空）
 *  - 高风险决策需 stepUpToken 二次认证
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *  - supersede 需记录取代关系
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Service
public class AnalysisResultService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisResultService.class);

    private final AnalysisResultRepository resultRepository;
    private final ResultQualityAssessmentRepository assessmentRepository;

    public AnalysisResultService(
            AnalysisResultRepository resultRepository,
            ResultQualityAssessmentRepository assessmentRepository
    ) {
        this.resultRepository = resultRepository;
        this.assessmentRepository = assessmentRepository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public AnalysisResultDto getResult(UUID tenantId, UUID resultId) {
        AnalysisResult entity = resultRepository.findByIdAndTenantId(resultId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisResult not found: " + resultId));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public List<AnalysisResultDto> getResultsByRun(UUID tenantId, UUID runId) {
        return resultRepository.findAllByTenantIdAndRunId(tenantId, runId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ResultQualityAssessmentDto getQualityAssessment(UUID tenantId, UUID resultId) {
        validateResultExists(tenantId, resultId);
        ResultQualityAssessment entity = assessmentRepository
                .findFirstByTenantIdAndResultIdOrderByAssessedAtDesc(tenantId, resultId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QualityAssessment not found for result: " + resultId));
        return toDto(entity);
    }

    // ── 提交质量评估 ──

    @Transactional
    public ResultQualityAssessmentDto submitQualityAssessment(
            UUID tenantId,
            UUID resultId,
            String currentUser,
            SubmitQualityAssessmentRequest request
    ) {
        AnalysisResult result = resultRepository.findByIdAndTenantId(resultId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisResult not found: " + resultId));

        // 决策需注册师签章的强制校验
        boolean requiresSeal = request.decision() == QualityDecision.ACCEPT_AS_REVISION
                || request.decision() == QualityDecision.EXCEPTION;
        if (requiresSeal && (request.sealId() == null || request.sealId().isBlank())) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "决策 " + request.decision() + " 需要注册师签章（sealId 必填）");
        }

        // 高风险决策强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        // 创建评估记录
        ResultQualityAssessment assessment = new ResultQualityAssessment();
        assessment.setTenantId(tenantId);
        assessment.setResultId(resultId);
        assessment.setDecision(request.decision());
        assessment.setChecklist(request.checklist() != null ? request.checklist() : "[]");
        assessment.setComment(request.comment());
        assessment.setAssessorId(currentUser);
        assessment.setAssessorRole(request.assessorRole());
        assessment.setAssessorQualification(request.assessorQualification());
        assessment.setRequiresSeal(requiresSeal);
        assessment.setSealId(request.sealId());
        assessment.setSealedAt(requiresSeal ? Instant.now() : null);
        assessment.setAssessedAt(Instant.now());

        ResultQualityAssessment saved = assessmentRepository.save(assessment);

        // 更新结果质量状态
        ResultQualityStatus newStatus = mapDecisionToQualityStatus(request.decision());
        result.setQualityStatus(newStatus);
        resultRepository.save(result);

        log.info("QualityAssessment submitted: resultId={}, decision={}, tenantId={}, assessor={}",
                resultId, request.decision(), tenantId, currentUser);
        return toDto(saved);
    }

    // ── 创建变更影响提案（结果 → 变更域） ──

    @Transactional
    public UUID createImpactProposal(
            UUID tenantId,
            UUID resultId,
            String currentUser,
            ImpactProposalRequest request
    ) {
        validateResultExists(tenantId, resultId);

        // 高风险动作强制 stepUpToken
        validateStepUpToken(request.stepUpToken());

        // V0 占位：仅记录日志，不实际创建变更请求
        // V1 应通过 ChangeRequestService 创建变更请求并返回变更 ID
        UUID proposalId = UUID.randomUUID();
        log.info("ImpactProposal created (V0 placeholder): proposalId={}, resultId={}, tenantId={}, initiatedBy={}",
                proposalId, resultId, tenantId, currentUser);
        return proposalId;
    }

    // ── 标记结果被取代 ──

    @Transactional
    public AnalysisResultDto supersedeResult(
            UUID tenantId,
            UUID resultId,
            UUID supersededBy,
            String currentUser
    ) {
        AnalysisResult entity = resultRepository.findByIdAndTenantId(resultId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AnalysisResult not found: " + resultId));

        if (entity.getQualityStatus() == ResultQualityStatus.SUPERSEDED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "结果已被标记为 SUPERSEDED");
        }

        entity.setQualityStatus(ResultQualityStatus.SUPERSEDED);
        entity.setSupersededBy(supersededBy);
        entity.setSupersededAt(Instant.now());

        AnalysisResult saved = resultRepository.save(entity);
        log.info("AnalysisResult superseded: id={}, supersededBy={}, tenantId={}, operator={}",
                resultId, supersededBy, tenantId, currentUser);
        return toDto(saved);
    }

    // ── 辅助方法 ──

    private void validateResultExists(UUID tenantId, UUID resultId) {
        if (resultRepository.findByIdAndTenantId(resultId, tenantId).isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    HttpStatus.NOT_FOUND,
                    "AnalysisResult not found: " + resultId);
        }
    }

    private ResultQualityStatus mapDecisionToQualityStatus(QualityDecision decision) {
        return switch (decision) {
            case ACCEPT_AS_DRAFT, ACCEPT_AS_REVISION -> ResultQualityStatus.VALID;
            case EXCEPTION -> ResultQualityStatus.QUESTIONABLE;
            case REJECT -> ResultQualityStatus.INVALID;
            case NEEDS_MORE_INFO -> ResultQualityStatus.PENDING;
            case ESCALATE -> ResultQualityStatus.QUESTIONABLE;
        };
    }

    private void validateStepUpToken(String stepUpToken) {
        if (stepUpToken == null || stepUpToken.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "高风险动作必须提供 stepUpToken");
        }
    }

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

    // ── 实体 → DTO ──

    public AnalysisResultDto toDto(AnalysisResult entity) {
        return new AnalysisResultDto(
                entity.getId(),
                entity.getRunId(),
                entity.getProblemId(),
                entity.getName(),
                entity.getQualityStatus(),
                entity.getGeneratedAt(),
                entity.getSizeMb(),
                entity.getVariables(),
                entity.getCases(),
                entity.getTimeSteps(),
                entity.getSpatialPoints(),
                entity.getMetrics(),
                entity.getBenchmarkComparison(),
                entity.getDownloadUrl(),
                entity.getSupersededBy(),
                entity.getSupersededAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public ResultQualityAssessmentDto toDto(ResultQualityAssessment entity) {
        return new ResultQualityAssessmentDto(
                entity.getId(),
                entity.getResultId(),
                entity.getDecision(),
                entity.getChecklist(),
                entity.getComment(),
                entity.getAssessorId(),
                entity.getAssessorRole(),
                entity.getAssessorQualification(),
                entity.isRequiresSeal(),
                entity.getSealId(),
                entity.getSealedAt(),
                entity.getAssessedAt(),
                entity.getCreatedAt()
        );
    }
}
