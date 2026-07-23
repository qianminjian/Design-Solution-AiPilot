package com.platform.core.workflow.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.workflow.domain.GateDecision;
import com.platform.core.workflow.domain.ProjectBaseline;
import com.platform.core.workflow.domain.RevisionStatus;
import com.platform.core.workflow.repository.GateDecisionRepository;
import com.platform.core.workflow.repository.ProjectBaselineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 工作流门禁决策应用服务
 * 涵盖门禁查询与决策
 *
 * <p>核心不变量：
 * <ul>
 *   <li>Gate 只能引用冻结（PUBLISHED）状态基线</li>
 *   <li>决策后 status 由 PENDING 转为 DECIDED</li>
 *   <li>租户隔离</li>
 *   <li>软删除记录自动过滤</li>
 * </ul>
 *
 * <p>与 portfolio.GateService 的区别：本服务操作 workflow schema 独立表，API 路径不嵌套在 project 下。
 */
@Service
public class GateService {

    private static final Logger log = LoggerFactory.getLogger(GateService.class);

    private final GateDecisionRepository gateRepository;
    private final ProjectBaselineRepository baselineRepository;
    private final ObjectMapper objectMapper;

    public GateService(GateDecisionRepository gateRepository,
                       ProjectBaselineRepository baselineRepository,
                       ObjectMapper objectMapper) {
        this.gateRepository = gateRepository;
        this.baselineRepository = baselineRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 列出阶段关联的门禁决策（按创建时间倒序）
     * 支持按状态与决策结论过滤
     *
     * @param tenantId 租户 ID
     * @param stageId  阶段实例 ID
     * @param status   门禁状态过滤（可空）
     * @param decision 决策结论过滤（可空）
     * @return 门禁决策 DTO 列表
     */
    @Transactional(readOnly = true)
    public List<GateDecisionDto> listGateDecisions(UUID tenantId, UUID stageId, String status, String decision) {
        List<GateDecision> gates;
        if (status != null && !status.isBlank()) {
            gates = gateRepository.findByStageIdAndStatus(stageId, status);
        } else {
            gates = gateRepository.findByStageIdOrderByCreatedAtDesc(stageId);
        }
        return gates.stream()
                .filter(g -> tenantId.equals(g.getTenantId()))
                .filter(g -> decision == null || decision.isBlank() || decision.equals(g.getDecision()))
                .map(this::toDto)
                .toList();
    }

    /**
     * 门禁决策
     * 业务规则：
     * 1. 门禁必须存在且同租户
     * 2. 如指定 baselineId，基线必须存在且 status=PUBLISHED（核心不变量）
     * 3. 决策后 status 由 PENDING 转为 DECIDED，记录 decided_at
     *
     * @param tenantId 租户 ID
     * @param gateId   门禁决策 ID
     * @param request  决策请求
     * @return 更新后的门禁决策 DTO
     */
    @Transactional
    public GateDecisionDto decideGate(UUID tenantId, UUID gateId, DecideGateRequest request) {
        GateDecision gate = loadGateOrThrow(tenantId, gateId);

        if (request.baselineId() != null) {
            validateBaselineFrozen(tenantId, request.baselineId());
            gate.setBaselineId(request.baselineId());
        }

        gate.setDecision(request.decision());
        gate.setComment(request.comment());
        gate.setEvidence(serializeEvidence(request.evidence()));
        gate.setDecidedAt(Instant.now());
        gate.setStatus("DECIDED");

        GateDecision saved = gateRepository.save(gate);
        log.info("工作流门禁决策成功 tenantId={} gateId={} decision={}",
                tenantId, gateId, request.decision());
        return toDto(saved);
    }

    // ── 内部辅助方法 ──

    /**
     * 校验基线存在且为冻结（PUBLISHED）状态
     * 核心不变量：Gate 只能引用冻结基线
     */
    private void validateBaselineFrozen(UUID tenantId, UUID baselineId) {
        ProjectBaseline baseline = baselineRepository.findByIdAndTenantId(baselineId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.BASELINE_NOT_FOUND,
                        "项目基线不存在: " + baselineId));
        if (baseline.getStatus() != RevisionStatus.PUBLISHED) {
            throw new BusinessException(ErrorCode.BASELINE_NOT_FROZEN,
                    "基线未冻结，不可被门禁引用: baselineId=" + baselineId
                            + " status=" + baseline.getStatus());
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
