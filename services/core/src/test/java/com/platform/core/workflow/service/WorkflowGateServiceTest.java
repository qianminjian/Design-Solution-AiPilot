package com.platform.core.workflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.workflow.domain.WorkflowGateDecision;
import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import com.platform.core.workflow.repository.WorkflowGateDecisionRepository;
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
 * WorkflowGateService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>门禁列表查询（按状态/决策过滤、租户隔离）</li>
 *   <li>门禁决策（PENDING → DECIDED，关联基线必须为 PUBLISHED）</li>
 *   <li>门禁不存在异常、基线不存在异常、基线未冻结异常</li>
 *   <li>evidence JSON 序列化</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class WorkflowGateServiceTest {

    @Mock
    private WorkflowGateDecisionRepository gateRepository;

    @Mock
    private WorkflowProjectBaselineRepository baselineRepository;

    private WorkflowGateService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID stageId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID gateId = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private final UUID baselineId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @BeforeEach
    void setUp() {
        service = new WorkflowGateService(gateRepository, baselineRepository, new ObjectMapper());
    }

    @Nested
    @DisplayName("查询门禁决策列表")
    class ListGates {

        @Test
        @DisplayName("应该返回阶段下所有门禁决策")
        void shouldReturnAllGatesForStage() {
            WorkflowGateDecision g1 = buildGate(gateId, tenantId, projectId, stageId, "G0");
            when(gateRepository.findByStageIdOrderByCreatedAtDesc(stageId))
                    .thenReturn(List.of(g1));

            List<GateDecisionDto> result = service.listGateDecisions(tenantId, stageId, null, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).gateCode()).isEqualTo("G0");
        }

        @Test
        @DisplayName("应该支持按状态过滤")
        void shouldFilterByStatus() {
            WorkflowGateDecision g1 = buildGate(gateId, tenantId, projectId, stageId, "G0");
            g1.setStatus("DECIDED");
            when(gateRepository.findByStageIdAndStatus(stageId, "DECIDED"))
                    .thenReturn(List.of(g1));

            List<GateDecisionDto> result = service.listGateDecisions(tenantId, stageId, "DECIDED", null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).status()).isEqualTo("DECIDED");
        }

        @Test
        @DisplayName("应该支持按决策结论过滤")
        void shouldFilterByDecision() {
            WorkflowGateDecision g1 = buildGate(gateId, tenantId, projectId, stageId, "G0");
            g1.setDecision("APPROVED");
            WorkflowGateDecision g2 = buildGate(
                    UUID.fromString("66666666-6666-6666-6666-666666666666"),
                    tenantId, projectId, stageId, "G1");
            g2.setDecision("REWORK_REQUIRED");

            when(gateRepository.findByStageIdOrderByCreatedAtDesc(stageId))
                    .thenReturn(List.of(g1, g2));

            List<GateDecisionDto> result = service.listGateDecisions(
                    tenantId, stageId, null, "APPROVED");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).decision()).isEqualTo("APPROVED");
        }

        @Test
        @DisplayName("应该过滤掉其他租户的门禁")
        void shouldFilterOutOtherTenants() {
            WorkflowGateDecision own = buildGate(gateId, tenantId, projectId, stageId, "G0");
            WorkflowGateDecision other = buildGate(
                    UUID.fromString("66666666-6666-6666-6666-666666666666"),
                    UUID.randomUUID(), projectId, stageId, "G1");

            when(gateRepository.findByStageIdOrderByCreatedAtDesc(stageId))
                    .thenReturn(List.of(own, other));

            List<GateDecisionDto> result = service.listGateDecisions(tenantId, stageId, null, null);

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
            WorkflowGateDecision gate = buildGate(gateId, tenantId, projectId, stageId, "G0");
            gate.setStatus("PENDING");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(WorkflowGateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过门禁", null, List.of());

            GateDecisionDto dto = service.decideGate(tenantId, gateId, request);

            assertThat(dto.status()).isEqualTo("DECIDED");
            assertThat(dto.decision()).isEqualTo("APPROVED");
            assertThat(dto.decidedAt()).isNotNull();
            verify(gateRepository).save(gate);
        }

        @Test
        @DisplayName("应该携带证据列表并序列化为 JSON")
        void shouldSerializeEvidence() {
            WorkflowGateDecision gate = buildGate(gateId, tenantId, projectId, stageId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(WorkflowGateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", null, List.of("doc-1", "doc-2"));

            GateDecisionDto dto = service.decideGate(tenantId, gateId, request);

            // evidence 非空时序列化为 JSON 数组字符串
            assertThat(dto.evidence()).contains("doc-1").contains("doc-2");
        }

        @Test
        @DisplayName("应该在关联未冻结基线时抛出 BASELINE_NOT_FROZEN 异常")
        void shouldThrowWhenBaselineNotFrozen() {
            WorkflowGateDecision gate = buildGate(gateId, tenantId, projectId, stageId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));

            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.DRAFT);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FROZEN);
        }

        @Test
        @DisplayName("应该在关联基线不存在时抛出 BASELINE_NOT_FOUND 异常")
        void shouldThrowWhenBaselineNotFound() {
            WorkflowGateDecision gate = buildGate(gateId, tenantId, projectId, stageId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.empty());

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BASELINE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在门禁不存在时抛出 GATE_NOT_FOUND 异常")
        void shouldThrowWhenGateNotFound() {
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.empty());

            DecideGateRequest request = new DecideGateRequest("APPROVED", "通过", null, null);

            assertThatThrownBy(() -> service.decideGate(tenantId, gateId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.GATE_NOT_FOUND);
        }

        @Test
        @DisplayName("应该成功关联已冻结基线")
        void shouldAttachFrozenBaseline() {
            WorkflowGateDecision gate = buildGate(gateId, tenantId, projectId, stageId, "G0");
            when(gateRepository.findByIdAndTenantId(gateId, tenantId))
                    .thenReturn(Optional.of(gate));
            when(gateRepository.save(any(WorkflowGateDecision.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            WorkflowProjectBaseline baseline = buildBaseline(baselineId, tenantId, projectId, 1L);
            baseline.setStatus(WorkflowRevisionStatus.PUBLISHED);
            when(baselineRepository.findByIdAndTenantId(baselineId, tenantId))
                    .thenReturn(Optional.of(baseline));

            DecideGateRequest request = new DecideGateRequest(
                    "APPROVED", "通过", baselineId, null);

            GateDecisionDto dto = service.decideGate(tenantId, gateId, request);

            assertThat(dto.baselineId()).isEqualTo(baselineId);
        }
    }

    // ── 辅助方法 ──

    private WorkflowGateDecision buildGate(UUID id, UUID tenantId, UUID projectId,
                                           UUID stageId, String gateCode) {
        WorkflowGateDecision g = new WorkflowGateDecision();
        g.setId(id);
        g.setTenantId(tenantId);
        g.setProjectId(projectId);
        g.setStageId(stageId);
        g.setGateCode(gateCode);
        g.setGateName(gateCode + "门禁");
        g.setStatus("PENDING");
        return g;
    }

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
