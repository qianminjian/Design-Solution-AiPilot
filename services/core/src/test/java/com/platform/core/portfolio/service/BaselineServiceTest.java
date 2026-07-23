package com.platform.core.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.Project;
import com.platform.core.portfolio.domain.ProjectBaseline;
import com.platform.core.portfolio.domain.RevisionStatus;
import com.platform.core.portfolio.dto.FreezeBaselineRequest;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.repository.ProjectBaselineRepository;
import com.platform.core.portfolio.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * BaselineService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>冻结基线（revision_no 单调递增、状态为 PUBLISHED、frozen_at 自动填充）</li>
 *   <li>基线列表查询（项目存在校验、租户隔离、按修订号倒序）</li>
 *   <li>基线详情查询（项目存在校验、项目匹配校验）</li>
 *   <li>项目不存在、基线不存在、基线不属于项目异常</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class BaselineServiceTest {

    @Mock
    private ProjectBaselineRepository baselineRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Captor
    private ArgumentCaptor<ProjectBaseline> baselineCaptor;

    private BaselineService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID baselineId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new BaselineService(baselineRepository, projectRepository, new ObjectMapper());
    }

    @Nested
    @DisplayName("冻结基线")
    class FreezeBaseline {

        @Test
        @DisplayName("应该成功冻结基线并自动计算 revision_no = max + 1")
        void shouldFreezeBaselineWithNextRevisionNo() {
            stubProjectExists();
            when(baselineRepository.findMaxRevisionNoByProjectId(projectId)).thenReturn(3L);
            when(baselineRepository.save(any(ProjectBaseline.class))).thenAnswer(invocation -> {
                ProjectBaseline b = invocation.getArgument(0);
                b.setId(baselineId);
                return b;
            });

            FreezeBaselineRequest request = new FreezeBaselineRequest(
                    "v4 基线", "第四次冻结", Map.of("author", "张三"));

            ProjectBaselineDto dto = service.freezeBaseline(tenantId, projectId, request);

            assertThat(dto.id()).isEqualTo(baselineId);
            assertThat(dto.revisionNo()).isEqualTo(4L);
            assertThat(dto.status()).isEqualTo(RevisionStatus.PUBLISHED.name());
            assertThat(dto.frozenAt()).isNotNull();
            assertThat(dto.metadata()).contains("author");

            verify(baselineRepository).save(baselineCaptor.capture());
            ProjectBaseline saved = baselineCaptor.getValue();
            assertThat(saved.getTenantId()).isEqualTo(tenantId);
            assertThat(saved.getRevisionNo()).isEqualTo(4L);
            assertThat(saved.getStatus()).isEqualTo(RevisionStatus.PUBLISHED);
        }

        @Test
        @DisplayName("应该在无历史基线时从 revision_no = 1 开始")
        void shouldStartFromRevisionOneWhenNoHistory() {
            stubProjectExists();
            when(baselineRepository.findMaxRevisionNoByProjectId(projectId)).thenReturn(0L);
            when(baselineRepository.save(any(ProjectBaseline.class))).thenAnswer(invocation -> {
                ProjectBaseline b = invocation.getArgument(0);
                b.setId(baselineId);
                return b;
            });

            FreezeBaselineRequest request = new FreezeBaselineRequest(
                    "首个基线", "初始冻结", null);

            ProjectBaselineDto dto = service.freezeBaseline(tenantId, projectId, request);

            assertThat(dto.revisionNo()).isEqualTo(1L);
            assertThat(dto.metadata()).isEqualTo("{}");
        }

        @Test
        @DisplayName("应该在 maxRevision 为 null 时从 1 开始")
        void shouldHandleNullMaxRevision() {
            stubProjectExists();
            when(baselineRepository.findMaxRevisionNoByProjectId(projectId)).thenReturn(null);
            when(baselineRepository.save(any(ProjectBaseline.class))).thenAnswer(invocation -> {
                ProjectBaseline b = invocation.getArgument(0);
                b.setId(baselineId);
                return b;
            });

            FreezeBaselineRequest request = new FreezeBaselineRequest(
                    "首个基线", null, null);

            ProjectBaselineDto dto = service.freezeBaseline(tenantId, projectId, request);

            assertThat(dto.revisionNo()).isEqualTo(1L);
        }

        @Test
        @DisplayName("应该在项目不存在时抛出 PROJECT_NOT_FOUND 异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.empty());

            FreezeBaselineRequest request = new FreezeBaselineRequest("基线", null, null);

            assertThatThrownBy(() -> service.freezeBaseline(tenantId, projectId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("查询基线列表")
    class ListBaselines {

        @Test
        @DisplayName("应该返回项目下所有基线（按修订号倒序）")
        void shouldReturnBaselinesByRevisionNoDesc() {
            stubProjectExists();

            ProjectBaseline b1 = buildBaseline(baselineId, tenantId, projectId, 2L);
            ProjectBaseline b2 = buildBaseline(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    tenantId, projectId, 1L);

            when(baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId))
                    .thenReturn(List.of(b1, b2));

            List<ProjectBaselineDto> result = service.listBaselines(tenantId, projectId);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).revisionNo()).isEqualTo(2L);
            assertThat(result.get(1).revisionNo()).isEqualTo(1L);
        }

        @Test
        @DisplayName("应该过滤掉其他租户的基线")
        void shouldFilterOutOtherTenants() {
            stubProjectExists();

            ProjectBaseline own = buildBaseline(baselineId, tenantId, projectId, 1L);
            ProjectBaseline other = buildBaseline(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    UUID.randomUUID(), projectId, 2L);

            when(baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId))
                    .thenReturn(List.of(own, other));

            List<ProjectBaselineDto> result = service.listBaselines(tenantId, projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).tenantId()).isEqualTo(tenantId);
        }

        @Test
        @DisplayName("应该在项目不存在时抛出 PROJECT_NOT_FOUND 异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.listBaselines(tenantId, projectId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("查询基线详情")
    class GetBaseline {

        @Test
        @DisplayName("应该返回基线详情")
        void shouldReturnBaselineDetail() {
            stubProjectExists();

            ProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            ProjectBaselineDto dto = service.getBaseline(tenantId, projectId, baselineId);

            assertThat(dto.id()).isEqualTo(baselineId);
            assertThat(dto.revisionNo()).isEqualTo(1L);
        }

        @Test
        @DisplayName("应该在基线不存在时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotFound() {
            stubProjectExists();
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getBaseline(tenantId, projectId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在基线不属于该项目时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotInProject() {
            stubProjectExists();

            ProjectBaseline baseline = buildBaseline(baselineId, tenantId,
                    UUID.randomUUID(), 1L);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            assertThatThrownBy(() -> service.getBaseline(tenantId, projectId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在项目不存在时抛出 PROJECT_NOT_FOUND 异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getBaseline(tenantId, projectId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }
    }

    // ── 辅助方法 ──

    private void stubProjectExists() {
        Project project = new Project();
        project.setId(projectId);
        project.setTenantId(tenantId);
        when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                .thenReturn(Optional.of(project));
    }

    private ProjectBaseline buildBaseline(UUID id, UUID tenantId, UUID projectId, Long revisionNo) {
        ProjectBaseline b = new ProjectBaseline();
        b.setId(id);
        b.setTenantId(tenantId);
        b.setProjectId(projectId);
        b.setRevisionNo(revisionNo);
        b.setName("基线-" + revisionNo);
        b.setStatus(RevisionStatus.PUBLISHED);
        return b;
    }
}
