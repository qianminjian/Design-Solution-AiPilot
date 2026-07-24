package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.compliance.domain.ComplianceRuleSet;
import com.platform.core.compliance.domain.RuleSetRule;
import com.platform.core.compliance.dto.ComplianceRuleSetDto;
import com.platform.core.compliance.dto.CreateRuleSetRequest;
import com.platform.core.compliance.repository.ComplianceRuleSetRepository;
import com.platform.core.compliance.repository.RuleSetRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 合规规则集服务单元测试
 *
 * 覆盖：创建（含重名校验）、查询、分页列表、软删除、规则添加与移除。
 */
@ExtendWith(MockitoExtension.class)
class RuleSetServiceTest {

    @Mock
    private ComplianceRuleSetRepository ruleSetRepository;

    @Mock
    private RuleSetRuleRepository ruleSetRuleRepository;

    private RuleSetService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID ruleSetId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new RuleSetService(ruleSetRepository, ruleSetRuleRepository);
    }

    @Nested
    @DisplayName("createRuleSet 创建规则集")
    class CreateRuleSet {

        @Test
        @DisplayName("应该正常创建规则集")
        void shouldCreateRuleSet() {
            // Arrange
            CreateRuleSetRequest request = new CreateRuleSetRequest(
                    "规则集-001", "描述", "STG-P1", null);
            when(ruleSetRepository.existsByTenantIdAndName(tenantId, "规则集-001")).thenReturn(false);
            when(ruleSetRepository.save(any())).thenReturn(buildRuleSet());
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            ComplianceRuleSetDto dto = service.createRuleSet(tenantId, request);

            // Assert
            assertThat(dto.name()).isEqualTo("规则集-001");
            assertThat(dto.status()).isEqualTo("DRAFT");
            verify(ruleSetRepository).save(any());
        }

        @Test
        @DisplayName("重复名称应该抛出异常")
        void duplicateNameShouldThrow() {
            // Arrange
            CreateRuleSetRequest request = new CreateRuleSetRequest(
                    "规则集-001", "描述", "STG-P1", null);
            when(ruleSetRepository.existsByTenantIdAndName(tenantId, "规则集-001")).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> service.createRuleSet(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("规则集名称在租户内已存在");
        }

        @Test
        @DisplayName("带规则列表应该创建并添加规则")
        void shouldCreateWithRules() {
            // Arrange
            CreateRuleSetRequest.RuleSetRuleEntry entry = new CreateRuleSetRequest.RuleSetRuleEntry(
                    revisionId, 1);
            CreateRuleSetRequest request = new CreateRuleSetRequest(
                    "规则集-001", "描述", "STG-P1", List.of(entry));
            when(ruleSetRepository.existsByTenantIdAndName(tenantId, "规则集-001")).thenReturn(false);
            when(ruleSetRepository.save(any())).thenReturn(buildRuleSet());
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            service.createRuleSet(tenantId, request);

            // Assert
            verify(ruleSetRuleRepository).save(any());
        }
    }

    @Nested
    @DisplayName("getRuleSet 查询规则集")
    class GetRuleSet {

        @Test
        @DisplayName("应该返回规则集 DTO")
        void shouldReturnDto() {
            // Arrange
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            ComplianceRuleSetDto dto = service.getRuleSet(tenantId, ruleSetId);

            // Assert
            assertThat(dto.id()).isEqualTo(ruleSetId);
            assertThat(dto.name()).isEqualTo("规则集-001");
        }

        @Test
        @DisplayName("不存在的 ID 应该抛出异常")
        void notFoundShouldThrow() {
            // Arrange
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getRuleSet(tenantId, ruleSetId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("规则集不存在");
        }
    }

    @Nested
    @DisplayName("listRuleSets 分页查询")
    class ListRuleSets {

        @Test
        @DisplayName("按 stageCode 过滤应该调用对应仓库方法")
        void shouldFilterByStageCode() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceRuleSet> page = new PageImpl<>(List.of(buildRuleSet()));
            when(ruleSetRepository.findByTenantIdAndStageCode(tenantId, "STG-P1", pageable))
                    .thenReturn(page);
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            Page<ComplianceRuleSetDto> result = service.listRuleSets(tenantId, "STG-P1", null, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(ruleSetRepository).findByTenantIdAndStageCode(tenantId, "STG-P1", pageable);
        }

        @Test
        @DisplayName("按 status 过滤应该调用对应仓库方法")
        void shouldFilterByStatus() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceRuleSet> page = new PageImpl<>(List.of(buildRuleSet()));
            when(ruleSetRepository.findByTenantIdAndStatus(tenantId, "ACTIVE", pageable))
                    .thenReturn(page);
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            Page<ComplianceRuleSetDto> result = service.listRuleSets(tenantId, null, "ACTIVE", pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(ruleSetRepository).findByTenantIdAndStatus(tenantId, "ACTIVE", pageable);
        }

        @Test
        @DisplayName("无过滤条件应该查询全部")
        void shouldQueryAllWhenNoFilter() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceRuleSet> page = new PageImpl<>(List.of(buildRuleSet()));
            when(ruleSetRepository.findByTenantId(tenantId, pageable)).thenReturn(page);
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            Page<ComplianceRuleSetDto> result = service.listRuleSets(tenantId, null, null, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(ruleSetRepository).findByTenantId(tenantId, pageable);
        }
    }

    @Nested
    @DisplayName("deleteRuleSet 软删除规则集")
    class DeleteRuleSet {

        @Test
        @DisplayName("应该设置 deletedAt 字段")
        void shouldSetDeletedAt() {
            // Arrange
            ComplianceRuleSet ruleSet = buildRuleSet();
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.of(ruleSet));
            when(ruleSetRepository.save(any())).thenReturn(ruleSet);

            // Act
            service.deleteRuleSet(tenantId, ruleSetId);

            // Assert
            assertThat(ruleSet.getDeletedAt()).isNotNull();
            verify(ruleSetRepository).save(ruleSet);
        }

        @Test
        @DisplayName("不存在的 ID 应该抛出异常")
        void notFoundShouldThrow() {
            // Arrange
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.deleteRuleSet(tenantId, ruleSetId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("规则集不存在");
        }
    }

    @Nested
    @DisplayName("addRulesToRuleSet 添加规则")
    class AddRulesToRuleSet {

        @Test
        @DisplayName("应该添加新规则")
        void shouldAddNewRule() {
            // Arrange
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.existsByRuleSetIdAndRevisionId(ruleSetId, revisionId))
                    .thenReturn(false);
            when(ruleSetRepository.findById(ruleSetId)).thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            CreateRuleSetRequest.RuleSetRuleEntry entry = new CreateRuleSetRequest.RuleSetRuleEntry(
                    revisionId, 1);
            service.addRulesToRuleSet(tenantId, ruleSetId, List.of(entry));

            // Assert
            verify(ruleSetRuleRepository).save(any());
        }

        @Test
        @DisplayName("已存在的规则应该跳过")
        void shouldSkipExistingRule() {
            // Arrange
            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.existsByRuleSetIdAndRevisionId(ruleSetId, revisionId))
                    .thenReturn(true);
            when(ruleSetRepository.findById(ruleSetId)).thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            CreateRuleSetRequest.RuleSetRuleEntry entry = new CreateRuleSetRequest.RuleSetRuleEntry(
                    revisionId, 1);
            service.addRulesToRuleSet(tenantId, ruleSetId, List.of(entry));

            // Assert
            verify(ruleSetRuleRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("removeRuleFromRuleSet 移除规则")
    class RemoveRuleFromRuleSet {

        @Test
        @DisplayName("应该删除指定规则")
        void shouldRemoveRule() {
            // Arrange
            RuleSetRule rsr = new RuleSetRule();
            rsr.setRuleSetId(ruleSetId);
            rsr.setRevisionId(revisionId);
            rsr.setPriority(1);

            when(ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId))
                    .thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.findByRuleSetId(ruleSetId)).thenReturn(List.of(rsr));
            when(ruleSetRepository.findById(ruleSetId)).thenReturn(Optional.of(buildRuleSet()));
            when(ruleSetRuleRepository.findByRuleSetIdOrderByPriorityAsc(ruleSetId))
                    .thenReturn(List.of());

            // Act
            service.removeRuleFromRuleSet(tenantId, ruleSetId, revisionId);

            // Assert
            verify(ruleSetRuleRepository).delete(rsr);
        }
    }

    private ComplianceRuleSet buildRuleSet() {
        ComplianceRuleSet ruleSet = new ComplianceRuleSet();
        ruleSet.setId(ruleSetId);
        ruleSet.setTenantId(tenantId);
        ruleSet.setName("规则集-001");
        ruleSet.setDescription("描述");
        ruleSet.setStageCode("STG-P1");
        ruleSet.setStatus("DRAFT");
        ruleSet.setCreatedAt(Instant.now());
        ruleSet.setUpdatedAt(Instant.now());
        ruleSet.setRowVersion(1L);
        return ruleSet;
    }
}
