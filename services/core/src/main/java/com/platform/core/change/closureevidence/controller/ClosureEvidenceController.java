package com.platform.core.change.closureevidence.controller;

import com.platform.core.change.closureevidence.dto.ClosureEvidenceDto;
import com.platform.core.change.closureevidence.dto.CreateClosureEvidenceRequest;
import com.platform.core.change.closureevidence.dto.VerifyClosureEvidenceRequest;
import com.platform.core.change.closureevidence.service.ClosureEvidenceService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 关闭证据 Controller（D37.16 P12）
 *
 * 路由：/api/v1/changes/{changeId}/closure-evidences
 *  - GET    /               列表
 *  - GET    /{id}           详情
 *  - POST   /               创建
 *  - DELETE /{id}           删除
 *  - POST   /{id}:verify    验证证据
 */
@RestController
@RequestMapping("/api/v1/changes/{changeId}/closure-evidences")
public class ClosureEvidenceController {

    private final ClosureEvidenceService closureEvidenceService;
    private final TenantResolver tenantResolver;

    public ClosureEvidenceController(
            ClosureEvidenceService closureEvidenceService,
            TenantResolver tenantResolver
    ) {
        this.closureEvidenceService = closureEvidenceService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public ApiResponse<List<ClosureEvidenceDto>> list(
            @PathVariable UUID changeId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                closureEvidenceService.listClosureEvidences(tenantId, changeId));
    }

    @GetMapping("/{id}")
    public ApiResponse<ClosureEvidenceDto> get(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(closureEvidenceService.getClosureEvidence(tenantId, id));
    }

    @PostMapping
    public ApiResponse<ClosureEvidenceDto> create(
            @PathVariable UUID changeId,
            @Valid @RequestBody CreateClosureEvidenceRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String submittedBy = resolveOperator(httpRequest);
        return ApiResponse.success(
                closureEvidenceService.createClosureEvidence(
                        tenantId, changeId, request, submittedBy));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        closureEvidenceService.deleteClosureEvidence(tenantId, id);
        return ApiResponse.success(null);
    }

    @PostMapping("/{id}:verify")
    public ApiResponse<ClosureEvidenceDto> verify(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            @Valid @RequestBody VerifyClosureEvidenceRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String verifiedBy = resolveOperator(httpRequest);
        return ApiResponse.success(
                closureEvidenceService.verifyClosureEvidence(
                        tenantId, id, request, verifiedBy));
    }

    private String resolveOperator(HttpServletRequest httpRequest) {
        String userId = httpRequest.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            return "system";
        }
        return userId;
    }
}
