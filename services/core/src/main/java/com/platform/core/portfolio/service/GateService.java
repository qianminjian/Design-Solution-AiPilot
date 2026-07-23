package com.platform.core.portfolio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.GateDecision;
import com.platform.core.portfolio.domain.ProjectBaseline;
import com.platform.core.portfolio.domain.RevisionStatus;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.repository.GateDecisionRepository;
import com.platform.core.portfolio.repository.ProjectBaselineRepository;
import com.platform.core.portfolio.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 门禁决策应用服务
 * 涵盖门禁查询与决策
 *
 * <p>核心不变量：
 * <ul>
 *   <li>Gate 只能引用冻结（PUBLISHED）状态基线</li>
 *   <li>决策后 status 由 PENDING 转为 DECIDED</li>
 *   <li>租户隔离</li>
 * </ul>
 */
@Service
public class GateService {

    private static final Logger log = LoggerFactory.getLogger(GateService.class);

    private final GateDecisionRepository gateRepository;
    private final ProjectBaselineRepository baselineRepository;
    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    public GateService(GateDecisionRepository gateRepository,
                       ProjectBaselineRepository baselineRepository,
                       ProjectRepository projectRepository,
                       ObjectMapper objectMapper) {
        this.gateRepository = gateRepository;
        this.baselineRepository = baselineRepository;
        this.projectRepository = projectRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 列出项目所有门禁（按创建时间倒序）
     */
    @Transactional(readOnly = true)
    public List<GateDecisionDto> listGates(UUID tenantId, UUID projectId) {
        validateProjectExists(tenantId, projectId);
        return gateRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .filter(g -> tenantId.equals(g.getTenantId()))
                .map(this::toDto)
                .toList();
    }

    /**
     * 门禁决策
     * 业务规则：
     * 1. 门禁必须存在且同租户
     * 2. 门禁必须属于指定项目
     * 3. 如指定 baselineId，基线必须存在且 status=PUBLISHED（核心不变量）
     * 4. 决策后 status 由 PENDING 转为 DECIDED，记录 decided_at
     */
    @Transactional
    public GateDecisionDto decideGate(UUID tenantId, UUID projectId, UUID gateId, DecideGateRequest request) {
        GateDecision gate = loadGateOrThrow(tenantId, gateId);
        validateProjectMatch(gate, projectId);

        if (request.baselineId() != null) {
            validateBaselineFrozen(tenantId, projectId, request.baselineId());
            gate.setBaselineId(request.baselineId());
        }

        gate.setDecision(request.decision());
        gate.setComment(request.comment());
        gate.setEvidence(serializeEvidence(request.evidence()));
        gate.setDecidedAt(Instant.now());
        gate.setStatus("DECIDED");

        GateDecision saved = gateRepository.save(gate);
        log.info("门禁决策成功 tenantId={} projectId={} gateId={} decision={}",
                tenantId, projectId, gateId, request.decision());
        return toDto(saved);
    }

    // ── 内部辅助方法 ──

    /**
     * 校验基线存在且为冻结（PUBLISHED）状态
     * 核心不变量：Gate 只能引用冻结基线
     */
    private void validateBaselineFrozen(UUID tenantId, UUID projectId, UUID baselineId) {
        ProjectBaseline baseline = baselineRepository.findByIdAndTenantId(baselineId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.BASELINE_NOT_FOUND,
                        "项目基线不存在: " + baselineId));
        if (!projectId.equals(baseline.getProjectId())) {
            throw new BusinessException(ErrorCode.BASELINE_NOT_FOUND,
                    "基线不属于该项目: baselineId=" + baselineId);
        }
        if (baseline.getStatus() != RevisionStatus.PUBLISHED) {
            throw new BusinessException(ErrorCode.BASELINE_NOT_FROZEN,
                    "基线未冻结，不可被门禁引用: baselineId=" + baselineId
                            + " status=" + baseline.getStatus());
        }
    }

    private void validateProjectMatch(GateDecision gate, UUID projectId) {
        if (!projectId.equals(gate.getProjectId())) {
            throw new BusinessException(ErrorCode.GATE_NOT_FOUND,
                    "门禁不属于该项目: gateId=" + gate.getId() + " projectId=" + projectId);
        }
    }

    private void validateProjectExists(UUID tenantId, UUID projectId) {
        if (projectRepository.findByIdAndTenantId(projectId, tenantId).isEmpty()) {
            throw new BusinessException(ErrorCode.PROJECT_NOT_FOUND,
                    "项目不存在: " + projectId);
        }
    }

    private GateDecision loadGateOrThrow(UUID tenantId, UUID gateId) {
        return gateRepository.findByIdAndTenantId(gateId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.GATE_NOT_FOUND,
                        "门禁决策不存在: " + gateId));
    }

    /**
     * 序列化证据列表为 JSONB 数组字符串
     */
    private String serializeEvidence(List<Object> evidence) {
        if (evidence == null || evidence.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(evidence);
        } catch (JsonProcessingException ex) {
            log.error("evidence 序列化失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "evidence JSON 序列化失败");
        }
    }

    private GateDecisionDto toDto(GateDecision g) {
        return new GateDecisionDto(
                g.getId(),
                g.getTenantId(),
                g.getProjectId(),
                g.getStageId(),
                g.getGateCode(),
                g.getGateName(),
                g.getStatus(),
                g.getDecision(),
                g.getDecidedAt(),
                g.getDecidedBy(),
                g.getBaselineId(),
                g.getComment(),
                g.getClassification() != null ? g.getClassification().name() : null,
                g.getEvidence(),
                g.getMetadata(),
                g.getCreatedAt(),
                g.getUpdatedAt(),
                g.getRowVersion()
        );
    }
}
