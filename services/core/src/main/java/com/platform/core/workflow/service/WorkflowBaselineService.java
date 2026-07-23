package com.platform.core.workflow.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import com.platform.core.workflow.repository.WorkflowProjectBaselineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 工作流项目基线应用服务
 * 涵盖基线冻结、详情查询与列表查询
 *
 * <p>核心不变量：
 * <ul>
 *   <li>冻结时 status 由 DRAFT 转为 PUBLISHED（即可被门禁引用）</li>
 *   <li>已冻结（PUBLISHED）的基线不可再次冻结</li>
 *   <li>租户隔离</li>
 *   <li>软删除记录自动过滤</li>
 * </ul>
 *
 * <p>与 portfolio.BaselineService 的区别：
 * <ul>
 *   <li>本服务操作 workflow schema 独立表</li>
 *   <li>freezeBaseline 是状态转换（DRAFT → PUBLISHED），不是创建</li>
 *   <li>DRAFT 基线由其他流程创建，本服务只负责冻结</li>
 * </ul>
 */
@Service
public class WorkflowBaselineService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowBaselineService.class);

    private final WorkflowProjectBaselineRepository baselineRepository;

    public WorkflowBaselineService(WorkflowProjectBaselineRepository baselineRepository) {
        this.baselineRepository = baselineRepository;
    }

    /**
     * 冻结基线
     * 业务规则：
     * 1. 基线必须存在且同租户
     * 2. 基线当前状态必须为 DRAFT（已冻结的不可再次冻结）
     * 3. status 切换为 PUBLISHED，设置 frozen_at
     *
     * @param tenantId   租户 ID
     * @param baselineId 基线 ID
     * @return 更新后的基线 DTO
     */
    @Transactional
    public ProjectBaselineDto freezeBaseline(UUID tenantId, UUID baselineId) {
        WorkflowProjectBaseline baseline = loadBaselineOrThrow(tenantId, baselineId);
        if (baseline.getStatus() != WorkflowRevisionStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BASELINE_NOT_FROZEN,
                    "基线当前状态不可冻结: baselineId=" + baselineId
                            + " status=" + baseline.getStatus()
                            + "（仅 DRAFT 状态可冻结）");
        }

        baseline.setStatus(WorkflowRevisionStatus.PUBLISHED);
        baseline.setFrozenAt(Instant.now());

        WorkflowProjectBaseline saved = baselineRepository.save(baseline);
        log.info("工作流冻结基线成功 tenantId={} baselineId={} revisionNo={}",
                tenantId, baselineId, saved.getRevisionNo());
        return toDto(saved);
    }

    /**
     * 查询基线详情
     *
     * @param tenantId   租户 ID
     * @param baselineId 基线 ID
     * @return 基线 DTO
     */
    @Transactional(readOnly = true)
    public ProjectBaselineDto getBaseline(UUID tenantId, UUID baselineId) {
        WorkflowProjectBaseline baseline = loadBaselineOrThrow(tenantId, baselineId);
        return toDto(baseline);
    }

    /**
     * 列出项目所有基线（按修订号倒序）
     *
     * @param tenantId  租户 ID
     * @param projectId 项目 ID
     * @return 基线 DTO 列表
     */
    @Transactional(readOnly = true)
    public List<ProjectBaselineDto> listBaselines(UUID tenantId, UUID projectId) {
        return baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId).stream()
                .filter(b -> tenantId.equals(b.getTenantId()))
                .map(this::toDto)
                .collect(java.util.stream.Collectors.toList());
    }

    // ── 内部辅助方法 ──

    private WorkflowProjectBaseline loadBaselineOrThrow(UUID tenantId, UUID baselineId) {
        return baselineRepository.findByIdAndTenantId(baselineId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.BASELINE_NOT_FOUND,
                        "项目基线不存在: " + baselineId));
    }

    private ProjectBaselineDto toDto(WorkflowProjectBaseline b) {
        return new ProjectBaselineDto(
                b.getId(),
                b.getTenantId(),
                b.getProjectId(),
                b.getRevisionNo(),
                b.getName(),
                b.getStatus() != null ? b.getStatus().name() : null,
                b.getFrozenAt(),
                b.getFrozenBy(),
                b.getDescription(),
                b.getClassification() != null ? b.getClassification().name() : null,
                b.getMetadata(),
                b.getCreatedAt(),
                b.getUpdatedAt(),
                b.getRowVersion()
        );
    }
}
