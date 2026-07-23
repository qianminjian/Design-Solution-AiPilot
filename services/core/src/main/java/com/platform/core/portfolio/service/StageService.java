package com.platform.core.portfolio.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.StageInstance;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.portfolio.repository.StageInstanceRepository;
import com.platform.core.portfolio.support.StageDefinitions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 阶段实例应用服务
 * 涵盖阶段列表查询与状态流转
 *
 * <p>核心不变量：
 * <ul>
 *   <li>状态流转遵循 D05.4.1 状态机</li>
 *   <li>ACTIVE 状态首次进入时设置 startedAt</li>
 *   <li>进入终态（CLOSED/CANCELLED）时设置 completedAt</li>
 *   <li>租户隔离</li>
 * </ul>
 */
@Service
public class StageService {

    private static final Logger log = LoggerFactory.getLogger(StageService.class);

    private final StageInstanceRepository stageInstanceRepository;

    public StageService(StageInstanceRepository stageInstanceRepository) {
        this.stageInstanceRepository = stageInstanceRepository;
    }

    /**
     * 列出项目所有阶段（按 stage_order 升序）
     */
    @Transactional(readOnly = true)
    public List<StageInstanceDto> listStages(UUID tenantId, UUID projectId) {
        return stageInstanceRepository.findByProjectIdOrderByStageOrder(projectId).stream()
                .filter(s -> tenantId.equals(s.getTenantId()))
                .map(this::toDto)
                .toList();
    }

    /**
     * 阶段状态流转
     * 业务规则：
     * 1. 阶段必须存在且同租户
     * 2. 当前状态不能是终态
     * 3. 状态流转必须符合 D05.4.1 状态机
     * 4. ACTIVE 状态首次进入时设置 startedAt
     * 5. 进入终态时设置 completedAt
     */
    @Transactional
    public StageInstanceDto transitionStage(UUID tenantId, UUID projectId, UUID stageId, TransitionStageRequest request) {
        StageInstance stage = loadStageOrThrow(tenantId, stageId);
        validateProjectMatch(stage, projectId);
        String targetStatus = request.targetStatus();
        validateTransition(stage.getStatus(), targetStatus);

        applyTransition(stage, targetStatus);
        StageInstance saved = stageInstanceRepository.save(stage);
        log.info("阶段流转成功 tenantId={} projectId={} stageId={} {} → {}",
                tenantId, projectId, stageId, stage.getStatus(), targetStatus);
        return toDto(saved);
    }

    // ── 内部辅助方法 ──

    private void validateProjectMatch(StageInstance stage, UUID projectId) {
        if (!projectId.equals(stage.getProjectId())) {
            throw new BusinessException(ErrorCode.STAGE_NOT_FOUND,
                    "阶段不属于该项目: stageId=" + stage.getId() + " projectId=" + projectId);
        }
    }

    private void validateTransition(String from, String to) {
        if (StageDefinitions.isTerminal(from)) {
            throw new BusinessException(ErrorCode.INVALID_STAGE_TRANSITION,
                    "阶段处于终态不可流转: " + from);
        }
        StageDefinitions.requireValidTransition(from, to);
    }

    private void applyTransition(StageInstance stage, String targetStatus) {
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

    private StageInstance loadStageOrThrow(UUID tenantId, UUID stageId) {
        return stageInstanceRepository.findByIdAndTenantId(stageId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.STAGE_NOT_FOUND,
                        "阶段实例不存在: " + stageId));
    }

    private StageInstanceDto toDto(StageInstance s) {
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
