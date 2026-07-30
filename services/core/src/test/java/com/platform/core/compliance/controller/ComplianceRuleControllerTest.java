package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceRuleDto;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import com.platform.core.compliance.dto.IdsImportResponse;
import com.platform.core.compliance.dto.RuleRevisionDto;
import com.platform.core.compliance.dto.UpdateRuleRequest;
import com.platform.core.compliance.service.ComplianceRuleService;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 合规规则控制器单元测试
 *
 * 覆盖：创建、分页查询、详情、更新、删除、
 * 规则修订创建/查询/激活、IDS 导入等关键路径。
 */
@ExtendWith(MockitoExtension.class)
class ComplianceRuleControllerTest {

    @Mock
    private ComplianceRuleService ruleService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private ComplianceRuleController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID ruleId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ComplianceRuleController(ruleService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建规则应该返回 201 状态码与创建成功的规则")
    void createShouldReturn201WithRule() {
        // Arrange
        CreateRuleRequest request = new CreateRuleRequest(
                "R-001", "楼梯净宽规则", "ARCHITECTURE", userId,
                "校验楼梯净宽", Map.of("code", "GB50016"));
        ComplianceRuleDto dto = buildRuleDto();
        when(ruleService.createRule(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<ComplianceRuleDto>> response =
                controller.create(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().code()).isZero();
        assertThat(response.getBody().data().id()).isEqualTo(ruleId);
        verify(ruleService).createRule(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse，且 page/pageSize 经边界保护")
    void listShouldReturnPageResponseWithSafePaging() {
        // Arrange
        ComplianceRuleDto dto = buildRuleDto();
        Page<ComplianceRuleDto> page = new PageImpl<>(List.of(dto));
        when(ruleService.listRules(eq(tenantId), eq("ARCHITECTURE"), eq("DRAFT"), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<ComplianceRuleDto> response = controller.list(
                0, 200, "ARCHITECTURE", "DRAFT", "asc", httpRequest);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().list()).hasSize(1);
        assertThat(response.data().page()).isEqualTo(1);
        assertThat(response.data().pageSize()).isEqualTo(100);
    }

    @Test
    @DisplayName("GET /{id} 应该返回规则详情")
    void getShouldReturnRuleDetail() {
        // Arrange
        ComplianceRuleDto dto = buildRuleDto();
        when(ruleService.getRule(eq(tenantId), eq(ruleId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceRuleDto> response = controller.get(ruleId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(ruleId);
        verify(ruleService).getRule(eq(tenantId), eq(ruleId));
    }

    @Test
    @DisplayName("PATCH /{id} 应该调用 Service 更新规则")
    void updateShouldInvokeService() {
        // Arrange
        UpdateRuleRequest request = new UpdateRuleRequest(
                "楼梯净宽规则-更新", "ARCHITECTURE", userId,
                "校验楼梯净宽与疏散距离", Map.of("code", "GB50016"), "DRAFT");
        ComplianceRuleDto dto = buildRuleDto();
        when(ruleService.updateRule(eq(tenantId), eq(ruleId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceRuleDto> response = controller.update(ruleId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(ruleId);
        verify(ruleService).updateRule(eq(tenantId), eq(ruleId), eq(request));
    }

    @Test
    @DisplayName("DELETE /{id} 应该调用 Service 删除规则")
    void deleteShouldInvokeService() {
        // Arrange
        org.mockito.Mockito.doNothing().when(ruleService).deleteRule(eq(tenantId), eq(ruleId));

        // Act
        ApiResponse<Void> response = controller.delete(ruleId, httpRequest);

        // Assert
        assertThat(response.code()).isZero();
        verify(ruleService).deleteRule(eq(tenantId), eq(ruleId));
    }

    @Test
    @DisplayName("POST /{id}/revisions 应该返回 201 状态码与创建的修订")
    void createRevisionShouldReturn201() {
        // Arrange
        CreateRuleRevisionRequest request = new CreateRuleRevisionRequest(
                "{\"check\":\"width>=1.1\"}", Map.of(), "{\"code\":\"GB50016\"}", "DEFAULT", "新增宽度校验");
        RuleRevisionDto dto = buildRevisionDto();
        when(ruleService.createRevision(eq(tenantId), eq(ruleId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<RuleRevisionDto>> response =
                controller.createRevision(ruleId, request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(revisionId);
        verify(ruleService).createRevision(eq(tenantId), eq(ruleId), eq(request));
    }

    @Test
    @DisplayName("GET /{id}/revisions 应该返回规则修订分页列表")
    void listRevisionsShouldReturnPage() {
        // Arrange
        RuleRevisionDto dto = buildRevisionDto();
        Page<RuleRevisionDto> page = new PageImpl<>(List.of(dto));
        when(ruleService.listRevisions(eq(tenantId), eq(ruleId), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<RuleRevisionDto> response =
                controller.listRevisions(ruleId, 1, 20, "desc", httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(ruleService).listRevisions(eq(tenantId), eq(ruleId), any(Pageable.class));
    }

    @Test
    @DisplayName("POST /revisions/{revisionId}/activate 应该激活指定修订")
    void activateRevisionShouldInvokeService() {
        // Arrange
        RuleRevisionDto dto = buildRevisionDto();
        when(ruleService.activateRevision(eq(tenantId), eq(revisionId))).thenReturn(dto);

        // Act
        ApiResponse<RuleRevisionDto> response =
                controller.activateRevision(revisionId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(revisionId);
        verify(ruleService).activateRevision(eq(tenantId), eq(revisionId));
    }

    @Test
    @DisplayName("GET /revisions/{revisionId} 应该返回修订详情")
    void getRevisionShouldReturnDetail() {
        // Arrange
        RuleRevisionDto dto = buildRevisionDto();
        when(ruleService.getRevision(eq(tenantId), eq(revisionId))).thenReturn(dto);

        // Act
        ApiResponse<RuleRevisionDto> response = controller.getRevision(revisionId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(revisionId);
        verify(ruleService).getRevision(eq(tenantId), eq(revisionId));
    }

    @Test
    @DisplayName("POST /import-ids 应该返回 201 状态码与导入结果")
    void importFromIdsShouldReturn201WithResponse() {
        // Arrange
        String xmlContent = "<ids:ids xmlns:ids=\"http://standards.buildingsmart.org/IDS\"></ids:ids>";
        IdsImportResponse importResponse = new IdsImportResponse(
                "Test Specification", "1.0", 0, 0, 0, List.of());
        when(ruleService.importFromIds(eq(tenantId), eq(xmlContent))).thenReturn(importResponse);

        // Act
        ResponseEntity<ApiResponse<IdsImportResponse>> response =
                controller.importFromIds(
                        new com.platform.core.compliance.dto.IdsImportRequest(xmlContent, null),
                        httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().specificationTitle()).isEqualTo("Test Specification");
        verify(ruleService).importFromIds(eq(tenantId), eq(xmlContent));
    }

    private ComplianceRuleDto buildRuleDto() {
        Instant now = Instant.now();
        return new ComplianceRuleDto(
                ruleId, tenantId, "R-001", "楼梯净宽规则", "ARCHITECTURE",
                userId, "DRAFT", "校验楼梯净宽", "{\"code\":\"GB50016\"}",
                now, now, userId, userId, 1L
        );
    }

    private RuleRevisionDto buildRevisionDto() {
        Instant now = Instant.now();
        return new RuleRevisionDto(
                revisionId, tenantId, ruleId, 1L,
                "{\"check\":\"width>=1.1\"}", "{}", "{\"code\":\"GB50016\"}",
                "DEFAULT", "DRAFT", now, userId, 1L
        );
    }
}
