package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceRuleSetDto;
import com.platform.core.compliance.dto.CreateRuleSetRequest;
import com.platform.core.compliance.service.RuleSetService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 规则集控制器单元测试
 *
 * 覆盖：创建、分页查询、详情、删除、添加规则、移除规则。
 */
@ExtendWith(MockitoExtension.class)
class RuleSetControllerTest {

    @Mock
    private RuleSetService ruleSetService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private RuleSetController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID ruleSetId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new RuleSetController(ruleSetService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建规则集应该返回 201 状态码")
    void createShouldReturn201() {
        // Arrange
        CreateRuleSetRequest request = new CreateRuleSetRequest(
                "方案设计规则集", "方案设计阶段合规校验", "SCHEME",
                List.of(new CreateRuleSetRequest.RuleSetRuleEntry(revisionId, 1)));
        ComplianceRuleSetDto dto = buildRuleSetDto();
        when(ruleSetService.createRuleSet(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<ComplianceRuleSetDto>> response =
                controller.create(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(ruleSetId);
        verify(ruleSetService).createRuleSet(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listShouldReturnPageResponse() {
        // Arrange
        ComplianceRuleSetDto dto = buildRuleSetDto();
        Page<ComplianceRuleSetDto> page = new PageImpl<>(List.of(dto));
        when(ruleSetService.listRuleSets(eq(tenantId), eq("SCHEME"), eq("DRAFT"), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<ComplianceRuleSetDto> response =
                controller.list(1, 20, "SCHEME", "DRAFT", "desc", httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(ruleSetService).listRuleSets(eq(tenantId), eq("SCHEME"), eq("DRAFT"), any(Pageable.class));
    }

    @Test
    @DisplayName("GET /{id} 应该返回规则集详情")
    void getShouldReturnRuleSetDetail() {
        // Arrange
        ComplianceRuleSetDto dto = buildRuleSetDto();
        when(ruleSetService.getRuleSet(eq(tenantId), eq(ruleSetId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceRuleSetDto> response = controller.get(ruleSetId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(ruleSetId);
        verify(ruleSetService).getRuleSet(eq(tenantId), eq(ruleSetId));
    }

    @Test
    @DisplayName("DELETE /{id} 应该调用 Service 删除规则集")
    void deleteShouldInvokeService() {
        // Arrange
        org.mockito.Mockito.doNothing().when(ruleSetService).deleteRuleSet(eq(tenantId), eq(ruleSetId));

        // Act
        ApiResponse<Void> response = controller.delete(ruleSetId, httpRequest);

        // Assert
        assertThat(response.code()).isZero();
        verify(ruleSetService).deleteRuleSet(eq(tenantId), eq(ruleSetId));
    }

    @Test
    @DisplayName("POST /{id}/rules 应该调用 Service 添加规则到规则集")
    void addRulesShouldInvokeService() {
        // Arrange
        List<CreateRuleSetRequest.RuleSetRuleEntry> entries = List.of(
                new CreateRuleSetRequest.RuleSetRuleEntry(revisionId, 1));
        ComplianceRuleSetDto dto = buildRuleSetDto();
        when(ruleSetService.addRulesToRuleSet(eq(tenantId), eq(ruleSetId), eq(entries))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceRuleSetDto> response =
                controller.addRules(ruleSetId, entries, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(ruleSetId);
        verify(ruleSetService).addRulesToRuleSet(eq(tenantId), eq(ruleSetId), eq(entries));
    }

    @Test
    @DisplayName("DELETE /{id}/rules/{revisionId} 应该调用 Service 从规则集移除规则")
    void removeRuleShouldInvokeService() {
        // Arrange
        ComplianceRuleSetDto dto = buildRuleSetDto();
        when(ruleSetService.removeRuleFromRuleSet(eq(tenantId), eq(ruleSetId), eq(revisionId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceRuleSetDto> response =
                controller.removeRule(ruleSetId, revisionId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(ruleSetId);
        verify(ruleSetService).removeRuleFromRuleSet(eq(tenantId), eq(ruleSetId), eq(revisionId));
    }

    private ComplianceRuleSetDto buildRuleSetDto() {
        Instant now = Instant.now();
        return new ComplianceRuleSetDto(
                ruleSetId, tenantId, "方案设计规则集", "方案设计阶段合规校验",
                "SCHEME", "DRAFT",
                List.of(new ComplianceRuleSetDto.RuleSetRuleDto(revisionId, 1)),
                now, now, userId, userId, 1L
        );
    }
}
