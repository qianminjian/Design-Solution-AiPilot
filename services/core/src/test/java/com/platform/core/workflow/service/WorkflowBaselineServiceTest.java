package com.platform.core.workflow.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import com.platform.core.workflow.repository.WorkflowProjectBaselineRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * WorkflowBaselineService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>冻结基线（DRAFT → PUBLISHED，自动设置 frozen_at）</li>
 *   <li>已冻结基线不可再次冻结</li>
 *   <li>基线详情查询</li>
 *   <li>基线列表查询（租户隔离）</li>
 *   <li>基线不存在异常</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class WorkflowBaselineServiceTest {

    @Mock
    private WorkflowProjectBaselineRepository baselineRepository;

    private WorkflowBaselineService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID baselineId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        service = new WorkflowBaselineService(baselineRepository);
    }

    @Nested
    @DisplayName("冻结基线")
    class FreezeBaseline {

        @Test
        @DisplayName("应该成功冻结 DRAFT 基线并设置 PUBLISHED 状态")
        void shouldFreezeDraftBaseline() {
            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.DRAFT);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));
            when(baselineRepository.save(any(WorkflowProjectBaseline.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ProjectBaselineDto dto = service.freezeBaseline(tenantId, baselineId);

            assertThat(dto.status()).isEqualTo(WorkflowRevisionStatus.PUBLISHED.name());
            assertThat(dto.frozenAt()).isNotNull();
            verify(baselineRepository).save(baseline);
        }

        @Test
        @DisplayName("应该在基线已冻结时抛出 BASELINE_NOT_FROZEN 异常")
        void shouldThrowWhenBaselineAlreadyFrozen() {
            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.PUBLISHED);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            assertThatThrownBy(() -> service.freezeBaseline(tenantId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FROZEN);
        }

        @Test
        @DisplayName("应该在基线状态为 SUPERSEDED 时抛出 BASELINE_NOT_FROZEN 异常")
        void shouldThrowWhenBaselineSuperseded() {
            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.SUPERSEDED);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            assertThatThrownBy(() -> service.freezeBaseline(tenantId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FROZEN);
        }

        @Test
        @DisplayName("应该在基线不存在时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotFound() {
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.freezeBaseline(tenantId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("查询基线")
    class QueryBaseline {

        @Test
        @DisplayName("应该返回基线详情")
        void shouldReturnBaselineDetail() {
            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.PUBLISHED);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            ProjectBaselineDto dto = service.getBaseline(tenantId, baselineId);

            assertThat(dto.id()).isEqualTo(baselineId);
            assertThat(dto.revisionNo()).isEqualTo(1L);
            assertThat(dto.status()).isEqualTo(WorkflowRevisionStatus.PUBLISHED.name());
        }

        @Test
        @DisplayName("应该在基线不存在时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotFound() {
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getBaseline(tenantId, baselineId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该返回项目下基线列表（按修订号倒序）")
        void shouldReturnBaselineListByRevisionNoDesc() {
            WorkflowProjectBaseline b1 = buildBaseline(baselineId, tenantId, projectId, 2L);
            WorkflowProjectBaseline b2 = buildBaseline(
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
            WorkflowProjectBaseline own = buildBaseline(baselineId, tenantId, projectId, 1L);
            WorkflowProjectBaseline other = buildBaseline(
                    UUID.fromString("44444444-4444-4444-4444-444444444444"),
                    UUID.randomUUID(), projectId, 2L);

            when(baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId))
                    .thenReturn(List.of(own, other));

            List<ProjectBaselineDto> result = service.listBaselines(tenantId, projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).tenantId()).isEqualTo(tenantId);
        }

        @Test
        @DisplayName("应该在无基线时返回空列表")
        void shouldReturnEmptyListWhenNoBaseline() {
            when(baselineRepository.findByProjectIdOrderByRevisionNoDesc(projectId))
                    .thenReturn(List.of());

            List<ProjectBaselineDto> result = service.listBaselines(tenantId, projectId);

            assertThat(result).isEmpty();
        }
    }

    // ── 辅助方法 ──

    private WorkflowProjectBaseline buildBaseline(UUID id, UUID tenantId, UUID projectId, Long revisionNo) {
        WorkflowProjectBaseline b = new WorkflowProjectBaseline();
        b.setId(id);
        b.setTenantId(tenantId);
        b.setProjectId(projectId);
        b.setRevisionNo(revisionNo);
        b.setName("基线-" + revisionNo);
        b.setStatus(WorkflowRevisionStatus.DRAFT);
        return b;
    }
}
