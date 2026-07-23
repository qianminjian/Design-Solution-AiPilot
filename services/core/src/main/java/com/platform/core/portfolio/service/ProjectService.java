package com.platform.core.portfolio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.repository.OrganizationRepository;
import com.platform.core.iam.repository.TenantRepository;
import com.platform.core.portfolio.domain.Project;
import com.platform.core.portfolio.domain.StageInstance;
import com.platform.core.portfolio.dto.CreateProjectRequest;
import com.platform.core.portfolio.dto.ListProjectsRequest;
import com.platform.core.portfolio.dto.ProjectDto;
import com.platform.core.portfolio.dto.UpdateProjectRequest;
import com.platform.core.portfolio.repository.ProjectRepository;
import com.platform.core.portfolio.repository.StageInstanceRepository;
import com.platform.core.portfolio.support.StageDefinitions;
import com.platform.core.portfolio.support.StageDefinitions.StageMeta;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 项目应用服务
 * 涵盖项目 CRUD 与阶段实例初始化
 *
 * <p>核心不变量：
 * <ul>
 *   <li>租户内 code 唯一</li>
 *   <li>创建项目时自动创建阶段实例（V0 默认裁剪集）</li>
 *   <li>租户隔离：所有查询带 tenant_id</li>
 * </ul>
 */
@Service
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final ProjectRepository projectRepository;
    private final StageInstanceRepository stageInstanceRepository;
    private final TenantRepository tenantRepository;
    private final OrganizationRepository organizationRepository;
    private final ObjectMapper objectMapper;

    public ProjectService(ProjectRepository projectRepository,
                          StageInstanceRepository stageInstanceRepository,
                          TenantRepository tenantRepository,
                          OrganizationRepository organizationRepository,
                          ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.stageInstanceRepository = stageInstanceRepository;
        this.tenantRepository = tenantRepository;
        this.organizationRepository = organizationRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建项目
     * 业务规则：
     * 1. 租户必须存在
     * 2. 同租户下 code 唯一（未软删）
     * 3. 如指定 organizationId，组织必须存在且同租户
     * 4. floorsMin ≤ floorsMax
     * 5. 根据 stages 创建阶段实例（未指定则用 V0 裁剪集）
     */
    @Transactional
    public ProjectDto createProject(UUID tenantId, CreateProjectRequest request) {
        validateTenantExists(tenantId);
        validateCodeUnique(tenantId, request.code());
        validateOrganizationIfPresent(tenantId, request.organizationId());
        validateFloorsRange(request.floorsMin(), request.floorsMax());

        Project project = buildProject(tenantId, request);
        Project saved = projectRepository.save(project);
        log.info("创建项目成功 tenantId={} projectId={} code={}", tenantId, saved.getId(), saved.getCode());

        createStageInstances(tenantId, saved.getId(), request.stages());
        return toDto(saved);
    }

    /**
     * 查询项目详情
     */
    @Transactional(readOnly = true)
    public ProjectDto getProject(UUID tenantId, UUID projectId) {
        return toDto(loadProjectOrThrow(tenantId, projectId));
    }

    /**
     * 分页查询项目（支持状态过滤）
     */
    @Transactional(readOnly = true)
    public Page<ProjectDto> listProjects(UUID tenantId, ListProjectsRequest request, Pageable pageable) {
        Page<Project> page = (request.status() == null || request.status().isBlank())
                ? projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId, pageable)
                : projectRepository.findByTenantIdAndStatusAndDeletedAtIsNull(tenantId, request.status(), pageable);
        return page.map(this::toDto);
    }

    /**
     * 部分更新项目（code 与 tenantId 不可变更）
     */
    @Transactional
    public ProjectDto updateProject(UUID tenantId, UUID projectId, UpdateProjectRequest request) {
        Project project = loadProjectOrThrow(tenantId, projectId);
        applyUpdate(project, request);
        Project saved = projectRepository.save(project);
        log.info("更新项目成功 tenantId={} projectId={}", tenantId, projectId);
        return toDto(saved);
    }

    // ── 内部辅助方法 ──

    private void validateTenantExists(UUID tenantId) {
        if (!tenantRepository.existsById(tenantId)) {
            throw new BusinessException(ErrorCode.TENANT_NOT_FOUND, "租户不存在: " + tenantId);
        }
    }

    private void validateCodeUnique(UUID tenantId, String code) {
        if (projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, code)) {
            throw new BusinessException(ErrorCode.PROJECT_CODE_ALREADY_EXISTS,
                    "项目编码在租户内已存在: " + code);
        }
    }

    private void validateOrganizationIfPresent(UUID tenantId, UUID organizationId) {
        if (organizationId == null) {
            return;
        }
        organizationRepository.findById(organizationId)
                .filter(o -> tenantId.equals(o.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.ORGANIZATION_NOT_FOUND,
                        "组织不存在: " + organizationId));
    }

    private void validateFloorsRange(Integer floorsMin, Integer floorsMax) {
        if (floorsMin != null && floorsMax != null && floorsMin > floorsMax) {
            throw new BusinessException(ErrorCode.PARAM_INVALID,
                    "floorsMin 不能大于 floorsMax");
        }
    }

    private Project buildProject(UUID tenantId, CreateProjectRequest request) {
        Project project = new Project();
        project.setTenantId(tenantId);
        project.setOrganizationId(request.organizationId());
        project.setCode(request.code());
        project.setName(request.name());
        project.setDescription(request.description());
        project.setBuildingType(request.buildingType() != null ? request.buildingType() : "OFFICE");
        project.setFloorsMin(request.floorsMin() != null ? request.floorsMin() : 5);
        project.setFloorsMax(request.floorsMax() != null ? request.floorsMax() : 15);
        project.setGfa(request.gfa());
        project.setSiteArea(request.siteArea());
        project.setRegion(request.region() != null ? request.region() : "us-east-1");
        project.setLanguage(request.language() != null ? request.language() : "en");
        project.setSettings(serializeJson(request.settings()));
        project.setMetadata(serializeJson(request.metadata()));
        project.setStartedAt(request.startedAt());
        project.setTargetCompletionAt(request.targetCompletionAt());
        return project;
    }

    /**
     * 创建项目阶段实例
     * 若 stages 为空，使用 V0 裁剪集（D05.18：P0/P1/P2/P5/P6/P7）
     */
    private void createStageInstances(UUID tenantId, UUID projectId, List<String> stageCodes) {
        List<String> codes = (stageCodes == null || stageCodes.isEmpty())
                ? StageDefinitions.V0_STAGE_CODES
                : stageCodes;
        for (String code : codes) {
            StageDefinitions.requireValidCode(code);
            StageMeta meta = StageDefinitions.getStageMeta(code).orElseThrow();
            StageInstance stage = new StageInstance();
            stage.setTenantId(tenantId);
            stage.setProjectId(projectId);
            stage.setStageCode(meta.code());
            stage.setStageName(meta.name());
            stage.setStageOrder(meta.order());
            stage.setStatus(StageDefinitions.STATUS_NOT_STARTED);
            stageInstanceRepository.save(stage);
        }
        log.info("创建阶段实例成功 tenantId={} projectId={} stages={}", tenantId, projectId, codes);
    }

    private void applyUpdate(Project project, UpdateProjectRequest request) {
        if (request.name() != null) {
            project.setName(request.name());
        }
        if (request.description() != null) {
            project.setDescription(request.description());
        }
        if (request.status() != null) {
            project.setStatus(request.status());
        }
        if (request.buildingType() != null) {
            project.setBuildingType(request.buildingType());
        }
        if (request.floorsMin() != null) {
            project.setFloorsMin(request.floorsMin());
        }
        if (request.floorsMax() != null) {
            project.setFloorsMax(request.floorsMax());
        }
        if (request.gfa() != null) {
            project.setGfa(request.gfa());
        }
        if (request.siteArea() != null) {
            project.setSiteArea(request.siteArea());
        }
        if (request.settings() != null) {
            project.setSettings(serializeJson(request.settings()));
        }
        if (request.metadata() != null) {
            project.setMetadata(serializeJson(request.metadata()));
        }
        if (request.startedAt() != null) {
            project.setStartedAt(request.startedAt());
        }
        if (request.targetCompletionAt() != null) {
            project.setTargetCompletionAt(request.targetCompletionAt());
        }
        validateFloorsRange(project.getFloorsMin(), project.getFloorsMax());
    }

    /**
     * 加载项目（带租户校验，防越权）
     */
    private Project loadProjectOrThrow(UUID tenantId, UUID projectId) {
        return projectRepository.findByIdAndTenantId(projectId, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.PROJECT_NOT_FOUND,
                        "项目不存在: " + projectId));
    }

    /**
     * Map → JSON 字符串（失败抛业务异常，不吞异常）
     */
    private String serializeJson(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            log.error("JSON 序列化失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "JSON 序列化失败");
        }
    }

    private ProjectDto toDto(Project p) {
        return new ProjectDto(
                p.getId(),
                p.getTenantId(),
                p.getOrganizationId(),
                p.getCode(),
                p.getName(),
                p.getDescription(),
                p.getStatus(),
                p.getBuildingType(),
                p.getFloorsMin(),
                p.getFloorsMax(),
                p.getGfa(),
                p.getSiteArea(),
                p.getRegion(),
                p.getLanguage(),
                p.getClassification() != null ? p.getClassification().name() : null,
                p.getSettings(),
                p.getMetadata(),
                p.getStartedAt(),
                p.getTargetCompletionAt(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getCreatedBy(),
                p.getUpdatedBy(),
                p.getRowVersion()
        );
    }
}
