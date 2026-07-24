package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.CheckResultDto;
import com.platform.core.compliance.dto.ComplianceCheckRunDto;
import com.platform.core.compliance.dto.CreateCheckRunRequest;
import com.platform.core.compliance.service.ComplianceCheckService;
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
 * 合规检查运行控制器单元测试
 *
 * 覆盖：创建检查运行、执行、详情、分页查询、检查结果列表。
 */
@ExtendWith(MockitoExtension.class)
class ComplianceCheckControllerTest {

    @Mock
    private ComplianceCheckService checkService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private ComplianceCheckController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID runId = UUID.randomUUID();
    private final UUID ruleSetId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID executionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ComplianceCheckController(checkService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建检查运行应该返回 201 状态码")
    void createCheckRunShouldReturn201() {
        // Arrange
        CreateCheckRunRequest request = new CreateCheckRunRequest(
                ruleSetId, projectId, Map.of("scope", "ALL"), "idem-001");
        ComplianceCheckRunDto dto = buildRunDto();
        when(checkService.createCheckRun(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<ComplianceCheckRunDto>> response =
                controller.createCheckRun(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(runId);
        verify(checkService).createCheckRun(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("POST /{id}/execute 应该触发执行并返回运行结果")
    void executeCheckRunShouldReturnUpdatedDto() {
        // Arrange
        ComplianceCheckRunDto dto = buildRunDto();
        when(checkService.executeCheckRun(eq(tenantId), eq(runId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceCheckRunDto> response =
                controller.executeCheckRun(runId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(runId);
        verify(checkService).executeCheckRun(eq(tenantId), eq(runId));
    }

    @Test
    @DisplayName("GET /{id} 应该返回检查运行详情")
    void getCheckRunShouldReturnDetail() {
        // Arrange
        ComplianceCheckRunDto dto = buildRunDto();
        when(checkService.getCheckRun(eq(tenantId), eq(runId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceCheckRunDto> response =
                controller.getCheckRun(runId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(runId);
        verify(checkService).getCheckRun(eq(tenantId), eq(runId));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listCheckRunsShouldReturnPageResponse() {
        // Arrange
        ComplianceCheckRunDto dto = buildRunDto();
        Page<ComplianceCheckRunDto> page = new PageImpl<>(List.of(dto));
        when(checkService.listCheckRuns(eq(tenantId), eq(projectId), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<ComplianceCheckRunDto> response =
                controller.listCheckRuns(1, 20, projectId, "desc", httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(checkService).listCheckRuns(eq(tenantId), eq(projectId), any(Pageable.class));
    }

    @Test
    @DisplayName("GET /executions/{executionId}/results 应该返回检查结果分页列表")
    void listCheckResultsShouldReturnPage() {
        // Arrange
        CheckResultDto dto = buildResultDto();
        Page<CheckResultDto> page = new PageImpl<>(List.of(dto));
        when(checkService.listCheckResults(eq(tenantId), eq(executionId), eq("PASS"), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<CheckResultDto> response =
                controller.listCheckResults(executionId, 1, 20, "PASS", httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(checkService).listCheckResults(eq(tenantId), eq(executionId), eq("PASS"), any(Pageable.class));
    }

    private ComplianceCheckRunDto buildRunDto() {
        Instant now = Instant.now();
        return new ComplianceCheckRunDto(
                runId, tenantId, projectId, ruleSetId,
                "COMPLETED", "5 通过/2 失败/1 不适用",
                List.of(), now, now, now, now, userId, userId, 1L
        );
    }

    private CheckResultDto buildResultDto() {
        return new CheckResultDto(
                UUID.randomUUID(), tenantId, executionId,
                UUID.randomUUID(), "WALL", "PASS",
                "1.2", "1.1", "楼梯净宽满足要求",
                "{}", Instant.now(), userId, 1L
        );
    }
}
