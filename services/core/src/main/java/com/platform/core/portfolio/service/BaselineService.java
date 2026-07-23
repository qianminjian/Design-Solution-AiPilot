package com.platform.core.portfolio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.ProjectBaseline;
import com.platform.core.portfolio.domain.RevisionStatus;
import com.platform.core.portfolio.dto.FreezeBaselineRequest;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.repository.ProjectBaselineRepository;
import com.platform.core.portfolio.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 项目基线应用服务
 * 涵盖基线冻结与查询
 *
 * <p>核心不变量：
 * <ul>
 *   <li>revision_no 项目内单调递增（冻结时取 max + 1）</li>
 *   <li>冻结时 status 设为 PUBLISHED（即可被门禁引用）</li>
 *   <li>租户隔离</li>
 * </ul>
 */
@Service
public class BaselineService {

    private static final Logger log = LoggerFactory.getLogger(BaselineService.class);

    private final ProjectBaselineRepository baselineRepository;
    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    public BaselineService(ProjectBaselineRepository baselineRepository,
                           ProjectRepository projectRepository,
                           ObjectMapper objectMapper) {
        this.baselineRepository = baselineRepository;
        this.projectRepository = projectRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 冻结基线
     * 业务规则：
     * 1. 项目必须存在且同租户
     * 2. revision_no = 项目下 max(revision_no) + 1
     * 3. status 直接设为 PUBLISHED（即冻结，可被门禁引用）
     * 4. 设置 frozen_at 与 frozen_by（V0 阶段 frozen_by 由审计上下文填充，暂留空）
     */
    @Transactional
    public ProjectBaselineDto freezeBaseline(UUID tenantId, UUID projectId, FreezeBaselineRequest request) {
        validateProjectExists(tenantId, projectId);

        Long maxRevision = baselineRepository.findMaxRevisionNoByProjectId(projectId);
        long nextRevision = (maxRevision == null ? 0L : maxRevision) + 1;

        ProjectBaseline baseline = new ProjectBaseline();
        baseline.setTenantId(tenantId);
        baseline.setProjectId(projectId);
        baseline.setRevisionNo(nextRevision);
        baseline.setName(request.name());
        baseline.setDescription(request.description());
        baseline.setStatus(RevisionStatus.PUBLISHED);
        baseline.setFrozenAt(Instant.now());
        baseline.setMetadata(serializeJson(request.metadata()));

        ProjectBaseline saved = baselineRepository.save(baseline);
        log.info("冻结基线成功 tenantId={} projectId={} baselineId={} revisionNo={}",
                tenantId, projectId, saved.getId(), nextRevision);
        return toDto(saved);
    }

    /**
     * 列出项目所有基线（按修订号倒序）
     */
    @Transactional(readOnly = true)
    public List<ProjectBaselineDto> listBaselines(UUID tenantId, UUID projectId) {
        validateProjectExists(tenantId, projectId);
        return baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId).stream()
                .filter(b -> tenantId.equals(b.getTenantId()))
                .map(this::toDto)
                .toList();
    }

    /**
     * 查询基线详情
     */
    @Transactional(readOnly = true)
    public ProjectBaselineDto getBaseline(UUID tenantId, UUID projectId, UUID baselineId) {
        validateProjectExists(tenantId, projectId);
        ProjectBaseline baseline = baselineRepository.findByIdAndTenantId(baselineId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.BASELINE_NOT_FOUND,
                        "项目基线不存在: " + baselineId));
        if (!projectId.equals(baseline.getProjectId())) {
            throw new BusinessException(ErrorCode.BASELINE_NOT_FOUND,
                    "基线不属于该项目: baselineId=" + baselineId);
        }
        return toDto(baseline);
    }

    // ── 内部辅助方法 ──

    private void validateProjectExists(UUID tenantId, UUID projectId) {
        if (projectRepository.findByIdAndTenantId(projectId, tenantId).isEmpty()) {
            throw new BusinessException(ErrorCode.PROJECT_NOT_FOUND,
                    "项目不存在: " + projectId);
        }
    }

    private String serializeJson(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            log.error("metadata 序列化失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "metadata JSON 序列化失败");
        }
    }

    private ProjectBaselineDto toDto(ProjectBaseline b) {
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
