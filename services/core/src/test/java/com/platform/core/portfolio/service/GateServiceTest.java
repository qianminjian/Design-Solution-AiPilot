package com.platform.core.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.GateDecision;
import com.platform.core.portfolio.domain.ProjectBaseline;
import com.platform.core.portfolio.domain.Project;
import com.platform.core.portfolio.domain.RevisionStatus;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.repository.GateDecisionRepository;
import com.platform.core.portfolio.repository.ProjectBaselineRepository;
import com.platform.core.portfolio.repository.ProjectRepository;
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
 * GateService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>门禁列表查询（项目存在校验、租户隔离）</li>
 *   <li>门禁决策（PENDING → DECIDED、项目匹配、关联基线必须冻结）</li>
 *   <li>门禁不存在、项目不匹配、基线未冻结、基线不存在异常</li>
 *   <li>evidence JSON 序列化</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class GateServiceTest {

    @Mock
    private GateDecisionRepository gateRepository;

    @Mock
    private ProjectBaselineRepository baselineRepository;

    @Mock
    private ProjectRepository projectRepository;

    private GateService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID gateId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID baselineId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() {
        service = new GateService(gateRepository, baselineRepository, projectRepository, new ObjectMapper());
    }

    @Nested
    @DisplayName("查询门禁列表")
    class ListGates {

        @Test
        @DisplayName("应该返回项目下所有门禁")
        void shouldReturnAllGatesForProject() {
            Project project = new Project();
            project.setId(projectId);
            project.setTenantId(tenantId);
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.of(project));

            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByProjectIdOrderByCreatedAtDesc(projectId))
                    .thenReturn(List.of(gate));

            List<GateDecisionDto> result = service.listGates(tenantId, projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).gateCode()).isEqualTo("G0");
        }

        @Test
        @DisplayName("应该在项目不存在时抛出 PROJECT_NOT_FOUND 异常")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.listGates(tenantId, projectId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该过滤掉其他租户的门禁")
        void shouldFilterOutOtherTenants() {
            Project project = new Project();
            project.setId(projectId);
            project.setTenantId(tenantId);
            when(projectRepository.findByIdAndTenantId(projectId, tenantId))
                    .thenReturn(Optional.of(project));

            GateDecision own = buildGate(gateId, tenantId, projectId, "G0");
            GateDecision other = buildGate(
                    UUID.fromString("55555555-5555-5555-5555-555555555555"),
                    UUID.randomUUID(), projectId, "G1");

            when(gateRepository.findByProjectIdOrderByCreatedAtDesc(projectId))
                    .thenReturn(List.of(own, other));

            List<GateDecisionDto> result = service.listGates(tenantId, projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).tenantId()).isEqualTo(tenantId);
        }
    }

    @Nested
    @DisplayName("门禁决策")
    class DecideGate {

        @Test
        @DisplayName("应该成功执行门禁决策并设置 DECIDED 状态")
        void shouldDecideGate() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            gate.setStatus("PENDING");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(GateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过门禁", null, List.of());

            GateDecisionDto dto = service.decideGate(tenantId, projectId, gateId, request);

            assertThat(dto.status()).isEqualTo("DECIDED");
            assertThat(dto.decision()).isEqualTo("APPROVED");
            assertThat(dto.decidedAt()).isNotNull();
            verify(gateRepository).save(gate);
        }

        @Test
        @DisplayName("应该携带证据列表并序列化为 JSON")
        void shouldSerializeEvidence() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(GateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", null, List.of("doc-1", "doc-2"));

            GateDecisionDto dto = service.decideGate(tenantId, projectId, gateId, request);

            assertThat(dto.evidence()).contains("doc-1").contains("doc-2");
        }

        @Test
        @DisplayName("应该在门禁不属于该项目时抛出 GATE_NOT_FOUND 异常")
        void shouldThrowWhenGateNotInProject() {
            GateDecision gate = buildGate(gateId, tenantId,
                    UUID.randomUUID(), "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));

            DecideGateRequest request = new DecideGateRequest("APPROVED", "通过", null, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, projectId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.GATE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在门禁不存在时抛出 GATE_NOT_FOUND 异常")
        void shouldThrowWhenGateNotFound() {
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.empty());

            DecideGateRequest request = new DecideGateRequest("APPROVED", "通过", null, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, projectId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.GATE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在关联基线不存在时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotFound() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.empty());

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, projectId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在关联基线不属于该项目时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotInProject() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));

            ProjectBaseline baseline = buildBaseline(baselineId, tenantId,
                    UUID.randomUUID(), 1L);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, projectId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在关联基线未冻结时抛出 BASELINE_NOT_FROZEN 异常")
        void shouldThrowWhenBaselineNotFrozen() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));

            ProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(RevisionStatus.DRAFT);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, projectId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FROZEN);
        }

        @Test
        @DisplayName("应该成功关联已冻结基线")
        void shouldAttachFrozenBaseline() {
            GateDecision gate = buildGate(gateId, tenantId, projectId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(GateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(RevisionStatus.PUBLISHED);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            GateDecisionDto dto = service.decideGate(tenantId, projectId, gateId, request);

            assertThat(dto.baselineId()).isEqualTo(baselineId);
        }
    }

    // ── 辅助方法 ──

    private GateDecision buildGate(UUID id, UUID tenantId, UUID projectId, String gateCode) {
        GateDecision g = new GateDecision();
        g.setId(id);
        g.setTenantId(tenantId);
        g.setProjectId(projectId);
        g.setGateCode(gateCode);
        g.setGateName(gateCode + "门禁");
        g.setStatus("PENDING");
        return g;
    }

    private ProjectBaseline buildBaseline(UUID id, UUID tenantId, UUID projectId, Long revisionNo) {
        ProjectBaseline b = new ProjectBaseline();
        b.setId(id);
        b.setTenantId(tenantId);
        b.setProjectId(projectId);
        b.setRevisionNo(revisionNo);
        b.setName("基线-" + revisionNo);
        b.setStatus(RevisionStatus.DRAFT);
        return b;
    }
}
