package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.CreateProjectRequest;
import com.platform.core.portfolio.dto.ProjectDto;
import com.platform.core.portfolio.dto.UpdateProjectRequest;
import com.platform.core.portfolio.service.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {

    @Mock
    private ProjectService projectService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private ProjectController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ProjectController(projectService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("创建项目应该返回 201 状态码与创建成功的项目")
    void createShouldReturn201WithProject() {
        CreateProjectRequest request = new CreateProjectRequest(
                "测试项目",
                "TEST-001",
                orgId,
                "办公建筑项目",
                "OFFICE",
                5,
                10,
                new BigDecimal("10000"),
                new BigDecimal("5000"),
                "us-east-1",
                "en",
                null,
                null,
                null,
                null,
                null
        );
        ProjectDto projectDto = buildProjectDto();
        when(projectService.createProject(eq(tenantId), any(CreateProjectRequest.class)))
                .thenReturn(projectDto);

        ResponseEntity<ApiResponse<ProjectDto>> response = controller.create(request, httpRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isZero();
        assertThat(response.getBody().data()).isNotNull();
        assertThat(response.getBody().data().id()).isEqualTo(projectId);
        assertThat(response.getBody().data().name()).isEqualTo("测试项目");
        verify(projectService).createProject(eq(tenantId), any(CreateProjectRequest.class));
    }

    @Test
    @DisplayName("分页查询项目应该返回正确的分页结构")
    void listShouldReturnPageResponse() {
        List<ProjectDto> projects = Arrays.asList(buildProjectDto(), buildProjectDto());
        Page<ProjectDto> page = new PageImpl<>(projects);
        when(projectService.listProjects(eq(tenantId), any(), any())).thenReturn(page);

        PageResponse<ProjectDto> response = controller.list(
                1, 20, null, null, "desc", httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data().list()).hasSize(2);
        assertThat(response.data().total()).isEqualTo(2);
        assertThat(response.data().page()).isEqualTo(1);
        assertThat(response.data().pageSize()).isEqualTo(20);
    }

    @Test
    @DisplayName("分页查询 page 小于 1 时应该使用 1")
    void listShouldUseMinPageWhenPageTooSmall() {
        List<ProjectDto> projects = Arrays.asList(buildProjectDto());
        Page<ProjectDto> page = new PageImpl<>(projects);
        when(projectService.listProjects(eq(tenantId), any(), any())).thenReturn(page);

        PageResponse<ProjectDto> response = controller.list(
                0, 20, null, null, "desc", httpRequest);

        assertThat(response.data().page()).isEqualTo(1);
    }

    @Test
    @DisplayName("分页查询 pageSize 超过上限时应该截断到 MAX_PAGE_SIZE")
    void listShouldCapPageSizeAtMax() {
        List<ProjectDto> projects = Arrays.asList(buildProjectDto());
        Page<ProjectDto> page = new PageImpl<>(projects);
        when(projectService.listProjects(eq(tenantId), any(), any())).thenReturn(page);

        PageResponse<ProjectDto> response = controller.list(
                1, 200, null, null, "desc", httpRequest);

        assertThat(response.data().pageSize()).isEqualTo(100);
    }

    @Test
    @DisplayName("查询项目详情应该返回正确的项目")
    void getShouldReturnProject() {
        ProjectDto projectDto = buildProjectDto();
        when(projectService.getProject(tenantId, projectId)).thenReturn(projectDto);

        ApiResponse<ProjectDto> response = controller.get(projectId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().id()).isEqualTo(projectId);
        verify(projectService).getProject(tenantId, projectId);
    }

    @Test
    @DisplayName("更新项目应该返回更新后的项目")
    void updateShouldReturnUpdatedProject() {
        UpdateProjectRequest request = new UpdateProjectRequest(
                "更新后的项目",
                "更新后的描述",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
        ProjectDto baseDto = buildProjectDto();
        ProjectDto updatedDto = new ProjectDto(
                baseDto.id(),
                baseDto.tenantId(),
                baseDto.organizationId(),
                baseDto.code(),
                "更新后的项目",
                "更新后的描述",
                baseDto.status(),
                baseDto.buildingType(),
                baseDto.floorsMin(),
                baseDto.floorsMax(),
                baseDto.gfa(),
                baseDto.siteArea(),
                baseDto.region(),
                baseDto.language(),
                baseDto.classification(),
                baseDto.settings(),
                baseDto.metadata(),
                baseDto.startedAt(),
                baseDto.targetCompletionAt(),
                baseDto.createdAt(),
                baseDto.updatedAt(),
                baseDto.createdBy(),
                baseDto.updatedBy(),
                baseDto.rowVersion()
        );
        when(projectService.updateProject(eq(tenantId), eq(projectId), any(UpdateProjectRequest.class)))
                .thenReturn(updatedDto);

        ApiResponse<ProjectDto> response = controller.update(projectId, request, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().name()).isEqualTo("更新后的项目");
        verify(projectService).updateProject(eq(tenantId), eq(projectId), any(UpdateProjectRequest.class));
    }

    private ProjectDto buildProjectDto() {
        Instant now = Instant.now();
        return new ProjectDto(
                projectId,
                tenantId,
                orgId,
                "TEST-001",
                "测试项目",
                "办公建筑方案设计",
                "ACTIVE",
                "OFFICE",
                5,
                10,
                new BigDecimal("10000"),
                new BigDecimal("5000"),
                "us-east-1",
                "en",
                "INTERNAL",
                "{}",
                "{}",
                now,
                now.plusSeconds(86400 * 30),
                now,
                now,
                UUID.randomUUID(),
                UUID.randomUUID(),
                1L
        );
    }
}
