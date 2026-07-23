package com.platform.core.workflow.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.portfolio.support.StageDefinitions;
import com.platform.core.workflow.domain.WorkflowStageInstance;
import com.platform.core.workflow.repository.WorkflowStageInstanceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 工作流阶段实例应用服务
 * 涵盖阶段列表查询与状态流转
 *
 * <p>核心不变量：
 * <ul>
 *   <li>状态流转遵循 D05.4.1 状态机（复用 portfolio.support.StageDefinitions）</li>
 *   <li>ACTIVE 状态首次进入时设置 startedAt</li>
 *   <li>进入终态（CLOSED/CANCELLED）时设置 completedAt</li>
 *   <li>租户隔离</li>
 *   <li>软删除记录自动过滤</li>
 * </ul>
 *
 * <p>与 portfolio.StageService 的区别：本服务操作 workflow schema 独立表，API 路径不嵌套在 project 下。
 */
@Service
public class StageWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(StageWorkflowService.class);

    private final WorkflowStageInstanceRepository stageInstanceRepository;

    public StageWorkflowService(WorkflowStageInstanceRepository stageInstanceRepository) {
        this.stageInstanceRepository = stageInstanceRepository;
    }

    /**
     * 列出项目所有阶段（按 stage_order 升序）
     * 支持按状态与阶段编码过滤
     *
     * @param tenantId  租户 ID
     * @param projectId 项目 ID
     * @param status    阶段状态过滤（可空）
     * @param stageCode 阶段编码过滤（可空）
     * @return 阶段实例 DTO 列表
     */
    @Transactional(readOnly = true)
    public List<StageInstanceDto> listStageInstances(UUID tenantId, UUID projectId, String status, String stageCode) {
        List<WorkflowStageInstance> stages;
        if (status != null && !status.isBlank()) {
            stages = stageInstanceRepository.findByProjectIdAndStatus(projectId, status);
        } else {
            stages = stageInstanceRepository.findByProjectIdOrderByStageOrder(projectId);
        }
        return stages.stream()
                .filter(s -> tenantId.equals(s.getTenantId()))
                .filter(s -> stageCode == null || stageCode.isBlank() || stageCode.equals(s.getStageCode()))
                .map(this::toDto)
                .toList();
    }

    /**
     * 阶段状态流转
     * 业务规则：
     * 1. 阶段必须存在且同租户
     * 2. 当前状态不能是终态
     * 3. 状态流转必须符合 D05.4.1 状态机（复用 StageDefinitions.isValidTransition）
     * 4. ACTIVE 状态首次进入时设置 startedAt
     * 5. 进入终态时设置 completedAt
     *
     * @param tenantId 租户 ID
     * @param stageId  阶段实例 ID
     * @param request  流转请求（包含目标状态与备注）
     * @return 更新后的阶段实例 DTO
     */
    @Transactional
    public StageInstanceDto transitionStage(UUID tenantId, UUID stageId, TransitionStageRequest request) {
        WorkflowStageInstance stage = loadStageOrThrow(tenantId, stageId);
        String currentStatus = stage.getStatus();
        String targetStatus = request.targetStatus();
        validateTransition(currentStatus, targetStatus);

        applyTransition(stage, targetStatus);
        WorkflowStageInstance saved = stageInstanceRepository.save(stage);
        log.info("工作流阶段流转成功 tenantId={} stageId={} {} → {}",
                tenantId, stageId, currentStatus, targetStatus);
        return toDto(saved);
    }

    // ── 内部辅助方法 ──

    private void validateTransition(String from, String to) {
        // 终态不可流转
        if (StageDefinitions.isTerminal(from)) {
            throw new BusinessException(ErrorCode.INVALID_STAGE_TRANSITION,
                    "阶段处于终态不可流转: " + from);
        }
        // 复用 portfolio.support.StageDefinitions.isValidTransition
        if (!StageDefinitions.isValidTransition(from, to)) {
            throw new BusinessException(ErrorCode.INVALID_STAGE_TRANSITION,
                    "非法阶段状态流转: " + from + " → " + to);
        }
    }

    private void applyTransition(WorkflowStageInstance stage, String targetStatus) {
        // 进入 ACTIVE 时若 startedAt 为空则填充
        if (StageDefinitions.STATUS_ACTIVE.equals(targetStatus) && stage.getStartedAt() == null) {
            stage.setStartedAt(Instant.now());
        }
        // 进入终态时填充 completedAt
        if (StageDefinitions.isTerminal(targetStatus)) {
            stage.setCompletedAt(Instant.now());
        }
        stage.setStatus(targetStatus);
    }

    private WorkflowStageInstance loadStageOrThrow(UUID tenantId, UUID stageId) {
        return stageInstanceRepository.findByIdAndTenantId(stageId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.STAGE_NOT_FOUND,
                        "阶段实例不存在: " + stageId));
    }

    private StageInstanceDto toDto(WorkflowStageInstance s) {
        return new StageInstanceDto(
                s.getId(),
                s.getTenantId(),
                s.getProjectId(),
                s.getStageCode(),
                s.getStageName(),
                s.getStageOrder(),
                s.getStatus(),
                s.getStartedAt(),
                s.getCompletedAt(),
                s.getClassification() != null ? s.getClassification().name() : null,
                s.getMetadata(),
                s.getCreatedAt(),
                s.getUpdatedAt(),
                s.getRowVersion()
        );
    }
}
