package com.platform.core.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.CheckResult;
import com.platform.core.compliance.domain.ComplianceCheckRun;
import com.platform.core.compliance.domain.RuleExecution;
import com.platform.core.compliance.domain.RuleRevision;
import com.platform.core.compliance.domain.RuleSetRule;
import com.platform.core.compliance.dto.ComplianceCheckRunDto;
import com.platform.core.compliance.dto.CreateCheckRunRequest;
import com.platform.core.compliance.repository.CheckResultRepository;
import com.platform.core.compliance.repository.ComplianceCheckRunRepository;
import com.platform.core.compliance.repository.ComplianceFindingRepository;
import com.platform.core.compliance.repository.RuleExecutionRepository;
import com.platform.core.compliance.repository.RuleRevisionRepository;
import com.platform.core.compliance.repository.RuleSetRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComplianceCheckServiceTest {

    @Mock
    private ComplianceCheckRunRepository checkRunRepository;

    @Mock
    private RuleExecutionRepository ruleExecutionRepository;

    @Mock
    private CheckResultRepository checkResultRepository;

    @Mock
    private ComplianceFindingRepository findingRepository;

    @Mock
    private RuleSetRuleRepository ruleSetRuleRepository;

    @Mock
    private RuleRevisionRepository ruleRevisionRepository;

    private ObjectMapper objectMapper;
    private ComplianceCheckService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID runId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID ruleSetId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ComplianceCheckService(
                checkRunRepository,
                ruleExecutionRepository,
                checkResultRepository,
                findingRepository,
                ruleSetRuleRepository,
                ruleRevisionRepository,
                objectMapper
        );
    }

    @Test
    @DisplayName("应该成功创建检查运行")
    void shouldCreateCheckRunSuccessfully() {
        ComplianceCheckRun savedRun = new ComplianceCheckRun();
        savedRun.setId(runId);
        savedRun.setTenantId(tenantId);
        savedRun.setProjectId(projectId);
        savedRun.setRuleSetId(ruleSetId);
        savedRun.setStatus("PENDING");
        savedRun.setCreatedAt(Instant.now());
        savedRun.setUpdatedAt(Instant.now());
        when(checkRunRepository.save(any(ComplianceCheckRun.class))).thenReturn(savedRun);

        CreateCheckRunRequest request = new CreateCheckRunRequest(
                ruleSetId,
                projectId,
                null,
                null
        );

        ComplianceCheckRunDto dto = service.createCheckRun(tenantId, request);

        assertThat(dto.id()).isEqualTo(runId);
        assertThat(dto.status()).isEqualTo("PENDING");
        assertThat(dto.projectId()).isEqualTo(projectId);
        assertThat(dto.ruleSetId()).isEqualTo(ruleSetId);
        verify(checkRunRepository).save(any(ComplianceCheckRun.class));
    }

    @Test
    @DisplayName("应该成功执行检查运行")
    void shouldExecuteCheckRunSuccessfully() {
        ComplianceCheckRun checkRun = new ComplianceCheckRun();
        checkRun.setId(runId);
        checkRun.setTenantId(tenantId);
        checkRun.setProjectId(projectId);
        checkRun.setRuleSetId(ruleSetId);
        checkRun.setStatus("PENDING");
        when(checkRunRepository.findByIdAndTenantId(eq(runId), eq(tenantId))).thenReturn(Optional.of(checkRun));
        when(checkRunRepository.save(any(ComplianceCheckRun.class))).thenReturn(checkRun);

        RuleSetRule ruleSetRule = new RuleSetRule();
        ruleSetRule.setRevisionId(revisionId);
        when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(eq(ruleSetId)))
                .thenReturn(List.of(ruleSetRule));

        RuleRevision revision = new RuleRevision();
        revision.setId(revisionId);
        revision.setDslJson("{\"ruleType\":\"PROPERTY_CHECK\",\"propertyName\":\"test\",\"expectedValue\":\"value-1\"}");
        when(ruleRevisionRepository.findById(eq(revisionId))).thenReturn(Optional.of(revision));

        when(checkResultRepository.saveAll(any(List.class))).thenReturn(new ArrayList<>());

        RuleExecution execution = new RuleExecution();
        execution.setId(UUID.randomUUID());
        execution.setRunId(runId);
        execution.setRevisionId(revisionId);
        when(ruleExecutionRepository.save(any(RuleExecution.class))).thenReturn(execution);

        ComplianceCheckRunDto dto = service.executeCheckRun(tenantId, runId);

        assertThat(dto.status()).isEqualTo("COMPLETED");
        assertThat(dto.executions()).hasSize(1);
    }

    @Test
    @DisplayName("应该在检查运行不存在时抛出业务异常")
    void shouldThrowWhenCheckRunNotFound() {
        when(checkRunRepository.findByIdAndTenantId(eq(runId), eq(tenantId))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.executeCheckRun(tenantId, runId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHECK_RUN_NOT_FOUND);
    }

    @Test
    @DisplayName("应该在检查运行状态不是 PENDING 时拒绝执行")
    void shouldRejectExecutionWhenNotPending() {
        ComplianceCheckRun checkRun = new ComplianceCheckRun();
        checkRun.setId(runId);
        checkRun.setTenantId(tenantId);
        checkRun.setStatus("COMPLETED");
        when(checkRunRepository.findByIdAndTenantId(eq(runId), eq(tenantId))).thenReturn(Optional.of(checkRun));

        assertThatThrownBy(() -> service.executeCheckRun(tenantId, runId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_RUN_STATUS);
    }

    @Test
    @DisplayName("应该成功查询检查运行详情")
    void shouldGetCheckRunSuccessfully() {
        ComplianceCheckRun checkRun = new ComplianceCheckRun();
        checkRun.setId(runId);
        checkRun.setTenantId(tenantId);
        checkRun.setProjectId(projectId);
        checkRun.setRuleSetId(ruleSetId);
        checkRun.setStatus("COMPLETED");
        checkRun.setCreatedAt(Instant.now());
        when(checkRunRepository.findByIdAndTenantId(eq(runId), eq(tenantId))).thenReturn(Optional.of(checkRun));
        when(ruleExecutionRepository.findByRunId(eq(runId))).thenReturn(new ArrayList<>());

        ComplianceCheckRunDto dto = service.getCheckRun(tenantId, runId);

        assertThat(dto.id()).isEqualTo(runId);
        assertThat(dto.status()).isEqualTo("COMPLETED");
    }
}