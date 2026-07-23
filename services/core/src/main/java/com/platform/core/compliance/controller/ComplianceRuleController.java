package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceRuleDto;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import com.platform.core.compliance.dto.IdsImportRequest;
import com.platform.core.compliance.dto.IdsImportResponse;
import com.platform.core.compliance.dto.RuleRevisionDto;
import com.platform.core.compliance.dto.UpdateRuleRequest;
import com.platform.core.compliance.service.ComplianceRuleService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/compliance-rules")
public class ComplianceRuleController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final ComplianceRuleService ruleService;
    private final TenantResolver tenantResolver;

    public ComplianceRuleController(ComplianceRuleService ruleService, TenantResolver tenantResolver) {
        this.ruleService = ruleService;
        this.tenantResolver = tenantResolver;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ComplianceRuleDto>> create(
            @Valid @RequestBody CreateRuleRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleDto dto = ruleService.createRule(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    @GetMapping
    public PageResponse<ComplianceRuleDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        Page<ComplianceRuleDto> result = ruleService.listRules(tenantId, category, status, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<ComplianceRuleDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleDto dto = ruleService.getRule(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PatchMapping("/{id}")
    public ApiResponse<ComplianceRuleDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRuleRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleDto dto = ruleService.updateRule(tenantId, id, request);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ruleService.deleteRule(tenantId, id);
        return ApiResponse.success(null);
    }

    @PostMapping("/{id}/revisions")
    public ResponseEntity<ApiResponse<RuleRevisionDto>> createRevision(
            @PathVariable UUID id,
            @Valid @RequestBody CreateRuleRevisionRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        RuleRevisionDto dto = ruleService.createRevision(tenantId, id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    @GetMapping("/{id}/revisions")
    public PageResponse<RuleRevisionDto> listRevisions(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, "revisionNo"));
        Page<RuleRevisionDto> result = ruleService.listRevisions(tenantId, id, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @PostMapping("/revisions/{revisionId}/activate")
    public ApiResponse<RuleRevisionDto> activateRevision(
            @PathVariable UUID revisionId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        RuleRevisionDto dto = ruleService.activateRevision(tenantId, revisionId);
        return ApiResponse.success(dto);
    }

    @GetMapping("/revisions/{revisionId}")
    public ApiResponse<RuleRevisionDto> getRevision(
            @PathVariable UUID revisionId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        RuleRevisionDto dto = ruleService.getRevision(tenantId, revisionId);
        return ApiResponse.success(dto);
    }

    @PostMapping("/import-ids")
    public ResponseEntity<ApiResponse<IdsImportResponse>> importFromIds(
            @Valid @RequestBody IdsImportRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        IdsImportResponse response = ruleService.importFromIds(tenantId, request.xmlContent());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}