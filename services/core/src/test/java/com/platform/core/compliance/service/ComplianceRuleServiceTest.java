package com.platform.core.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.ComplianceRule;
import com.platform.core.compliance.domain.RuleRevision;
import com.platform.core.compliance.dto.ComplianceRuleDto;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import com.platform.core.compliance.dto.RuleRevisionDto;
import com.platform.core.compliance.dto.UpdateRuleRequest;
import com.platform.core.compliance.repository.ComplianceRuleRepository;
import com.platform.core.compliance.repository.RuleRevisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComplianceRuleServiceTest {

    @Mock
    private ComplianceRuleRepository ruleRepository;

    @Mock
    private RuleRevisionRepository revisionRepository;

    private ObjectMapper objectMapper;
    private ComplianceRuleService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID ruleId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ComplianceRuleService(ruleRepository, revisionRepository, objectMapper, null, null);
    }

    @Test
    @DisplayName("应该成功创建规则")
    void shouldCreateRuleSuccessfully() {
        when(ruleRepository.existsByTenantIdAndRuleCode(eq(tenantId), eq("RULE-001"))).thenReturn(false);

        ComplianceRule savedRule = new ComplianceRule();
        savedRule.setId(ruleId);
        savedRule.setTenantId(tenantId);
        savedRule.setRuleCode("RULE-001");
        savedRule.setName("测试规则");
        savedRule.setCategory("BUILDING");
        savedRule.setStatus("CANDIDATE");
        savedRule.setCreatedAt(Instant.now());
        savedRule.setUpdatedAt(Instant.now());
        when(ruleRepository.save(any(ComplianceRule.class))).thenReturn(savedRule);

        CreateRuleRequest request = new CreateRuleRequest(
                "RULE-001",
                "测试规则",
                "BUILDING",
                null,
                "规则描述",
                new HashMap<>()
        );

        ComplianceRuleDto dto = service.createRule(tenantId, request);

        assertThat(dto.id()).isEqualTo(ruleId);
        assertThat(dto.ruleCode()).isEqualTo("RULE-001");
        assertThat(dto.name()).isEqualTo("测试规则");
        assertThat(dto.category()).isEqualTo("BUILDING");
        assertThat(dto.status()).isEqualTo("CANDIDATE");
        verify(ruleRepository).save(any(ComplianceRule.class));
    }

    @Test
    @DisplayName("应该在规则编码已存在时抛出业务异常")
    void shouldThrowWhenRuleCodeExists() {
        when(ruleRepository.existsByTenantIdAndRuleCode(eq(tenantId), eq("RULE-001"))).thenReturn(true);

        CreateRuleRequest request = new CreateRuleRequest(
                "RULE-001",
                "测试规则",
                "BUILDING",
                null,
                null,
                null
        );

        assertThatThrownBy(() -> service.createRule(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.RULE_CODE_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("应该成功查询规则详情")
    void shouldGetRuleSuccessfully() {
        ComplianceRule rule = new ComplianceRule();
        rule.setId(ruleId);
        rule.setTenantId(tenantId);
        rule.setRuleCode("RULE-001");
        rule.setName("测试规则");
        rule.setCategory("BUILDING");
        rule.setStatus("ACTIVE");
        rule.setCreatedAt(Instant.now());
        rule.setUpdatedAt(Instant.now());
        when(ruleRepository.findByIdAndTenantId(eq(ruleId), eq(tenantId))).thenReturn(Optional.of(rule));

        ComplianceRuleDto dto = service.getRule(tenantId, ruleId);

        assertThat(dto.id()).isEqualTo(ruleId);
        assertThat(dto.ruleCode()).isEqualTo("RULE-001");
    }

    @Test
    @DisplayName("应该在规则不存在时抛出业务异常")
    void shouldThrowWhenRuleNotFound() {
        when(ruleRepository.findByIdAndTenantId(eq(ruleId), eq(tenantId))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getRule(tenantId, ruleId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.RULE_NOT_FOUND);
    }

    @Test
    @DisplayName("应该成功更新规则")
    void shouldUpdateRuleSuccessfully() {
        ComplianceRule rule = new ComplianceRule();
        rule.setId(ruleId);
        rule.setTenantId(tenantId);
        rule.setRuleCode("RULE-001");
        rule.setName("旧名称");
        rule.setCategory("BUILDING");
        rule.setStatus("CANDIDATE");
        rule.setCreatedAt(Instant.now());
        rule.setUpdatedAt(Instant.now());
        when(ruleRepository.findByIdAndTenantId(eq(ruleId), eq(tenantId))).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any(ComplianceRule.class))).thenReturn(rule);

        UpdateRuleRequest request = new UpdateRuleRequest(
                "新名称",
                null,
                null,
                "新描述",
                new HashMap<>(),
                null
        );

        ComplianceRuleDto dto = service.updateRule(tenantId, ruleId, request);

        assertThat(dto.name()).isEqualTo("新名称");
        verify(ruleRepository).save(any(ComplianceRule.class));
    }

    @Test
    @DisplayName("应该成功创建规则版本")
    void shouldCreateRevisionSuccessfully() {
        ComplianceRule rule = new ComplianceRule();
        rule.setId(ruleId);
        rule.setTenantId(tenantId);
        when(ruleRepository.findByIdAndTenantId(eq(ruleId), eq(tenantId))).thenReturn(Optional.of(rule));

        when(revisionRepository.countByRuleId(eq(ruleId))).thenReturn(0L);

        RuleRevision savedRevision = new RuleRevision();
        savedRevision.setId(revisionId);
        savedRevision.setTenantId(tenantId);
        savedRevision.setRuleId(ruleId);
        savedRevision.setRevisionNo(1L);
        savedRevision.setStatus("DRAFT");
        savedRevision.setCreatedAt(Instant.now());
        when(revisionRepository.save(any(RuleRevision.class))).thenReturn(savedRevision);

        CreateRuleRevisionRequest request = new CreateRuleRevisionRequest(
                "{\"ruleType\":\"PROPERTY_CHECK\"}",
                new HashMap<>(),
                new HashMap<>(),
                "DEFAULT",
                "初始版本"
        );

        RuleRevisionDto dto = service.createRevision(tenantId, ruleId, request);

        assertThat(dto.id()).isEqualTo(revisionId);
        assertThat(dto.revisionNo()).isEqualTo(1L);
        assertThat(dto.status()).isEqualTo("DRAFT");
        verify(revisionRepository).save(any(RuleRevision.class));
    }

    @Test
    @DisplayName("应该成功激活已批准的规则版本")
    void shouldActivateApprovedRevision() {
        RuleRevision revision = new RuleRevision();
        revision.setId(revisionId);
        revision.setTenantId(tenantId);
        revision.setRuleId(ruleId);
        revision.setRevisionNo(1L);
        revision.setStatus("APPROVED");
        revision.setCreatedAt(Instant.now());
        when(revisionRepository.findByIdAndTenantId(eq(revisionId), eq(tenantId))).thenReturn(Optional.of(revision));
        when(revisionRepository.save(any(RuleRevision.class))).thenReturn(revision);

        RuleRevisionDto dto = service.activateRevision(tenantId, revisionId);

        assertThat(dto.status()).isEqualTo("ACTIVE");
        verify(revisionRepository).save(any(RuleRevision.class));
    }

    @Test
    @DisplayName("应该在规则版本未批准时拒绝激活")
    void shouldRejectActivationWhenNotApproved() {
        RuleRevision revision = new RuleRevision();
        revision.setId(revisionId);
        revision.setTenantId(tenantId);
        revision.setRevisionNo(1L);
        revision.setStatus("DRAFT");
        when(revisionRepository.findByIdAndTenantId(eq(revisionId), eq(tenantId))).thenReturn(Optional.of(revision));

        assertThatThrownBy(() -> service.activateRevision(tenantId, revisionId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.RULE_NOT_APPROVED);
    }

    @Test
    @DisplayName("应该成功软删除规则")
    void shouldSoftDeleteRule() {
        ComplianceRule rule = new ComplianceRule();
        rule.setId(ruleId);
        rule.setTenantId(tenantId);
        rule.setRuleCode("RULE-001");
        rule.setStatus("CANDIDATE");
        when(ruleRepository.findByIdAndTenantId(eq(ruleId), eq(tenantId))).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any(ComplianceRule.class))).thenReturn(rule);

        service.deleteRule(tenantId, ruleId);

        assertThat(rule.getDeletedAt()).isNotNull();
        verify(ruleRepository).save(any(ComplianceRule.class));
    }
}