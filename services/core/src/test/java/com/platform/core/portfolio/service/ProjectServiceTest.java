package com.platform.core.portfolio.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Organization;
import com.platform.core.iam.domain.Tenant;
import com.platform.core.iam.repository.OrganizationRepository;
import com.platform.core.iam.repository.TenantRepository;
import com.platform.core.portfolio.domain.Project;
import com.platform.core.portfolio.domain.StageInstance;
import com.platform.core.portfolio.dto.CreateProjectRequest;
import com.platform.core.portfolio.dto.ListProjectsRequest;
import com.platform.core.portfolio.dto.UpdateProjectRequest;
import com.platform.core.portfolio.repository.ProjectRepository;
import com.platform.core.portfolio.repository.StageInstanceRepository;
import com.platform.core.portfolio.support.StageDefinitions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ProjectService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>租户存在校验</li>
 *   <li>编码唯一性校验</li>
 *   <li>组织存在校验</li>
 *   <li>层数范围校验</li>
 *   <li>阶段实例自动创建</li>
 *   <li>项目查询与更新</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private StageInstanceRepository stageInstanceRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Captor
    private ArgumentCaptor<Project> projectCaptor;

    @Captor
    private ArgumentCaptor<StageInstance> stageCaptor;

    private ProjectService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID organizationId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new ProjectService(
                projectRepository,
                stageInstanceRepository,
                tenantRepository,
                organizationRepository,
                new com.fasterxml.jackson.databind.ObjectMapper()
        );
    }

    @Nested
    @DisplayName("创建项目")
    class CreateProject {

        @Test
        @DisplayName("应该成功创建项目并初始化阶段实例")
        void shouldCreateProjectAndInitializeStageInstances() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(false);
            when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> {
                Project p = invocation.getArgument(0);
                p.setId(projectId);
                return p;
            });

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目",
                    "proj-001",
                    null,
                    "测试描述",
                    "OFFICE",
                    5,
                    10,
                    BigDecimal.valueOf(10000),
                    BigDecimal.valueOf(5000),
                    "us-east-1",
                    "en",
                    null,
                    Map.of("key", "value"),
                    Map.of("meta", "data"),
                    null,
                    null
            );

            var dto = service.createProject(tenantId, request);

            assertThat(dto.id()).isEqualTo(projectId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.name()).isEqualTo("测试项目");
            assertThat(dto.code()).isEqualTo("proj-001");
            assertThat(dto.buildingType()).isEqualTo("OFFICE");
            assertThat(dto.floorsMin()).isEqualTo(5);
            assertThat(dto.floorsMax()).isEqualTo(10);

            verify(projectRepository).save(projectCaptor.capture());
            Project saved = projectCaptor.getValue();
            assertThat(saved.getTenantId()).isEqualTo(tenantId);
            assertThat(saved.getCode()).isEqualTo("proj-001");

            verify(stageInstanceRepository, org.mockito.Mockito.times(StageDefinitions.V0_STAGE_CODES.size()))
                    .save(stageCaptor.capture());
            List<StageInstance> stages = stageCaptor.getAllValues();
            assertThat(stages).hasSize(StageDefinitions.V0_STAGE_CODES.size());
            assertThat(stages.stream().map(StageInstance::getStageCode))
                    .containsExactlyInAnyOrderElementsOf(StageDefinitions.V0_STAGE_CODES);
        }

        @Test
        @DisplayName("应该在租户不存在时抛出业务异常")
        void shouldThrowWhenTenantNotFound() {
            when(tenantRepository.existsById(tenantId)).thenReturn(false);

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", null, null, null, null, null, null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.createProject(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.TENANT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在编码重复时抛出业务异常")
        void shouldThrowWhenCodeAlreadyExists() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(true);

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", null, null, null, null, null, null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.createProject(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_CODE_ALREADY_EXISTS);
        }

        @Test
        @DisplayName("应该在指定组织不存在时抛出业务异常")
        void shouldThrowWhenOrganizationNotFound() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(false);
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.empty());

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", organizationId, null, null, null, null, null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.createProject(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在指定组织不属于当前租户时抛出业务异常")
        void shouldThrowWhenOrganizationNotInTenant() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(false);

            Organization org = new Organization();
            org.setId(organizationId);
            org.setTenantId(UUID.randomUUID());
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.of(org));

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", organizationId, null, null, null, null, null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.createProject(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在 floorsMin 大于 floorsMax 时抛出业务异常")
        void shouldThrowWhenFloorsMinGreaterThanFloorsMax() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(false);

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", null, null, null, 15, 10, null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.createProject(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PARAM_INVALID);
        }

        @Test
        @DisplayName("应该使用默认层数（5-15）当未指定时")
        void shouldUseDefaultFloorsWhenNotSpecified() {
            when(tenantRepository.existsById(tenantId)).thenReturn(true);
            when(projectRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, "proj-001")).thenReturn(false);
            when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> {
                Project p = invocation.getArgument(0);
                p.setId(projectId);
                return p;
            });

            CreateProjectRequest request = new CreateProjectRequest(
                    "测试项目", "proj-001", null, null, null, null, null, null, null, null, null, null, null, null, null, null
            );

            var dto = service.createProject(tenantId, request);

            assertThat(dto.floorsMin()).isEqualTo(5);
            assertThat(dto.floorsMax()).isEqualTo(15);
        }
    }

    @Nested
    @DisplayName("查询项目")
    class GetProject {

        @Test
        @DisplayName("应该成功返回项目详情")
        void shouldReturnProjectDetail() {
            Project project = new Project();
            project.setId(projectId);
            project.setTenantId(tenantId);
            project.setCode("proj-001");
            project.setName("测试项目");

            when(projectRepository.findByIdAndTenantId(projectId, tenantId)).thenReturn(Optional.of(project));

            var dto = service.getProject(tenantId, projectId);

            assertThat(dto.id()).isEqualTo(projectId);
            assertThat(dto.code()).isEqualTo("proj-001");
            assertThat(dto.name()).isEqualTo("测试项目");
        }

        @Test
        @DisplayName("应该在项目不存在时抛出业务异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getProject(tenantId, projectId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该支持按状态分页查询项目")
        void shouldSupportPagedQueryWithStatusFilter() {
            Project project1 = new Project();
            project1.setId(projectId);
            project1.setTenantId(tenantId);
            project1.setCode("proj-001");
            project1.setName("项目1");
            project1.setStatus("ACTIVE");

            Pageable pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<Project> page = new PageImpl<>(List.of(project1), pageable, 1);

            when(projectRepository.findByTenantIdAndStatusAndDeletedAtIsNull(tenantId, "ACTIVE", pageable))
                    .thenReturn(page);

            ListProjectsRequest request = new ListProjectsRequest(1, 10, null, "desc", "ACTIVE", null);
            var result = service.listProjects(tenantId, request, pageable);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent().get(0).code()).isEqualTo("proj-001");
        }

        @Test
        @DisplayName("应该支持无状态过滤的分页查询")
        void shouldSupportPagedQueryWithoutStatusFilter() {
            Project project1 = new Project();
            project1.setId(projectId);
            project1.setTenantId(tenantId);
            project1.setCode("proj-001");

            Pageable pageable = PageRequest.of(0, 10);
            Page<Project> page = new PageImpl<>(List.of(project1), pageable, 1);

            when(projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId, pageable)).thenReturn(page);

            ListProjectsRequest request = new ListProjectsRequest(1, 10, null, "desc", null, null);
            var result = service.listProjects(tenantId, request, pageable);

            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("更新项目")
    class UpdateProject {

        @Test
        @DisplayName("应该成功更新项目")
        void shouldUpdateProject() {
            Project project = new Project();
            project.setId(projectId);
            project.setTenantId(tenantId);
            project.setName("旧名称");
            project.setCode("proj-001");

            when(projectRepository.findByIdAndTenantId(projectId, tenantId)).thenReturn(Optional.of(project));
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            UpdateProjectRequest request = new UpdateProjectRequest(
                    "新名称", "新描述", "ACTIVE", null, null, null, null, null, null, null, null, null
            );

            var dto = service.updateProject(tenantId, projectId, request);

            assertThat(dto.name()).isEqualTo("新名称");
            assertThat(dto.description()).isEqualTo("新描述");
            assertThat(dto.status()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("应该在项目不存在时抛出业务异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId)).thenReturn(Optional.empty());

            UpdateProjectRequest request = new UpdateProjectRequest("新名称", null, null, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> service.updateProject(tenantId, projectId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在更新后 floorsMin 大于 floorsMax 时抛出业务异常")
        void shouldThrowWhenUpdatedFloorsRangeInvalid() {
            Project project = new Project();
            project.setId(projectId);
            project.setTenantId(tenantId);
            project.setFloorsMin(5);
            project.setFloorsMax(10);

            when(projectRepository.findByIdAndTenantId(projectId, tenantId)).thenReturn(Optional.of(project));

            UpdateProjectRequest request = new UpdateProjectRequest(null, null, null, null, 15, 10, null, null, null, null, null, null);

            assertThatThrownBy(() -> service.updateProject(tenantId, projectId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PARAM_INVALID);
        }
    }
}
