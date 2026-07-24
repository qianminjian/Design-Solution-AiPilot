package com.platform.core.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.compliance.domain.ComplianceRule;
import com.platform.core.compliance.domain.RuleRevision;
import com.platform.core.compliance.dto.ComplianceRuleDto;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import com.platform.core.compliance.dto.RuleRevisionDto;
import com.platform.core.compliance.dto.UpdateRuleRequest;
import com.platform.core.compliance.ids.IdsParser;
import com.platform.core.compliance.ids.IdsRuleConverter;
import com.platform.core.compliance.repository.ComplianceRuleRepository;
import com.platform.core.compliance.repository.RuleRevisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
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
 * 合规规则服务单元测试
 *
 * 覆盖：创建、更新、删除、修订管理、激活。
 */
@ExtendWith(MockitoExtension.class)
class ComplianceRuleServiceTest {

    @Mock
    private ComplianceRuleRepository ruleRepository;

    @Mock
    private RuleRevisionRepository revisionRepository;

    @Mock
    private IdsParser idsParser;

    @Mock
    private IdsRuleConverter idsRuleConverter;

    private ObjectMapper objectMapper;
    private ComplianceRuleService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID ruleId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ComplianceRuleService(
                ruleRepository, revisionRepository, objectMapper, idsParser, idsRuleConverter);
    }

    @Test
    @DisplayName("createRule 应该创建规则并返回 DTO")
    void createRuleShouldSaveAndReturnDto() {
        // Arrange
        CreateRuleRequest request = new CreateRuleRequest(
                "FIRE-SAFETY-001", "消防疏散检查", "fire-safety",
                UUID.randomUUID(), "检查消防疏散通道是否符合规范", Map.of());
        when(ruleRepository.existsByTenantIdAndRuleCode(tenantId, "FIRE-SAFETY-001")).thenReturn(false);
        when(ruleRepository.save(any())).thenReturn(buildRule());

        // Act
        ComplianceRuleDto dto = service.createRule(tenantId, request);

        // Assert
        verify(ruleRepository).save(any());
    }

    @Test
    @DisplayName("createRule 重复编码应该抛出异常")
    void createRuleDuplicateCodeShouldThrow() {
        // Arrange
        CreateRuleRequest request = new CreateRuleRequest(
                "FIRE-SAFETY-001", "消防疏散检查", "fire-safety",
                UUID.randomUUID(), "描述", Map.of());
        when(ruleRepository.existsByTenantIdAndRuleCode(tenantId, "FIRE-SAFETY-001")).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> service.createRule(tenantId, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("规则编码在租户内已存在");
    }

    @Test
    @DisplayName("getRule 应该返回规则详情")
    void getRuleShouldReturnDto() {
        // Arrange
        when(ruleRepository.findByIdAndTenantId(ruleId, tenantId))
                .thenReturn(Optional.of(buildRule()));

        // Act
        ComplianceRuleDto dto = service.getRule(tenantId, ruleId);

        // Assert
        assertThat(dto.id()).isEqualTo(ruleId);
    }

    @Test
    @DisplayName("updateRule 应该更新规则属性")
    void updateRuleShouldUpdate() {
        // Arrange
        ComplianceRule rule = buildRule();
        when(ruleRepository.findByIdAndTenantId(ruleId, tenantId)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any())).thenReturn(rule);

        UpdateRuleRequest request = new UpdateRuleRequest(
                "新名称", "新分类", UUID.randomUUID(), "新描述", Map.of(), "ACTIVE");

        // Act
        ComplianceRuleDto dto = service.updateRule(tenantId, ruleId, request);

        // Assert
        verify(ruleRepository).save(any());
    }

    @Test
    @DisplayName("deleteRule 应该软删除规则")
    void deleteRuleShouldSoftDelete() {
        // Arrange
        ComplianceRule rule = buildRule();
        when(ruleRepository.findByIdAndTenantId(ruleId, tenantId)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(any())).thenReturn(rule);

        // Act
        service.deleteRule(tenantId, ruleId);

        // Assert
        verify(ruleRepository).save(any());
    }

    @Test
    @DisplayName("listRules 应该按分类过滤")
    void listRulesShouldFilterByCategory() {
        // Arrange
        Page<ComplianceRule> page = new PageImpl<>(List.of(buildRule()));
        when(ruleRepository.findByTenantIdAndCategory(any(), any(), any())).thenReturn(page);

        // Act
        Page<ComplianceRuleDto> result = service.listRules(tenantId, "fire-safety", null, Pageable.unpaged());

        // Assert
        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("createRevision 应该创建新版本")
    void createRevisionShouldCreate() {
        // Arrange
        when(ruleRepository.findByIdAndTenantId(ruleId, tenantId)).thenReturn(Optional.of(buildRule()));
        when(revisionRepository.countByRuleId(ruleId)).thenReturn(0L);
        when(revisionRepository.save(any())).thenReturn(buildRevision());

        CreateRuleRevisionRequest request = new CreateRuleRevisionRequest(
                "{\"condition\": \"exit_width >= 1.2\"}",
                Map.of("param", "value"),
                Map.of(),
                "default-engine",
                "初始化版本");

        // Act
        RuleRevisionDto dto = service.createRevision(tenantId, ruleId, request);

        // Assert
        verify(revisionRepository).save(any());
    }

    @Test
    @DisplayName("activateRevision 未批准版本应该抛出异常")
    void activateRevisionNotApprovedShouldThrow() {
        // Arrange
        RuleRevision revision = buildRevision();
        revision.setStatus("DRAFT");
        when(revisionRepository.findByIdAndTenantId(revisionId, tenantId))
                .thenReturn(Optional.of(revision));

        // Act & Assert
        assertThatThrownBy(() -> service.activateRevision(tenantId, revisionId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("规则版本未批准");
    }

    @Test
    @DisplayName("activateRevision 应该激活批准版本")
    void activateRevisionShouldActivate() {
        // Arrange
        RuleRevision revision = buildRevision();
        revision.setStatus("APPROVED");
        when(revisionRepository.findByIdAndTenantId(revisionId, tenantId))
                .thenReturn(Optional.of(revision));
        when(revisionRepository.save(any())).thenReturn(revision);

        // Act
        RuleRevisionDto dto = service.activateRevision(tenantId, revisionId);

        // Assert
        verify(revisionRepository).save(any());
    }

    private ComplianceRule buildRule() {
        ComplianceRule rule = new ComplianceRule();
        rule.setId(ruleId);
        rule.setTenantId(tenantId);
        rule.setRuleCode("FIRE-SAFETY-001");
        rule.setName("消防疏散检查");
        rule.setCategory("fire-safety");
        rule.setOwner(UUID.randomUUID());
        rule.setStatus("CANDIDATE");
        rule.setCreatedAt(Instant.now());
        rule.setUpdatedAt(Instant.now());
        return rule;
    }

    private RuleRevision buildRevision() {
        RuleRevision revision = new RuleRevision();
        revision.setId(revisionId);
        revision.setTenantId(tenantId);
        revision.setRuleId(ruleId);
        revision.setRevisionNo(1L);
        revision.setDslJson("{\"condition\": \"exit_width >= 1.2\"}");
        revision.setStatus("APPROVED");
        revision.setCreatedAt(Instant.now());
        return revision;
    }
}