package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceRuleSetDto;
import com.platform.core.compliance.dto.CreateRuleSetRequest;
import com.platform.core.compliance.service.RuleSetService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rule-sets")
public class RuleSetController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final RuleSetService ruleSetService;
    private final TenantResolver tenantResolver;

    public RuleSetController(RuleSetService ruleSetService, TenantResolver tenantResolver) {
        this.ruleSetService = ruleSetService;
        this.tenantResolver = tenantResolver;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ComplianceRuleSetDto>> create(
            @Valid @RequestBody CreateRuleSetRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleSetDto dto = ruleSetService.createRuleSet(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    @GetMapping
    public PageResponse<ComplianceRuleSetDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String stageCode,
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
        Page<ComplianceRuleSetDto> result = ruleSetService.listRuleSets(tenantId, stageCode, status, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<ComplianceRuleSetDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleSetDto dto = ruleSetService.getRuleSet(tenantId, id);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ruleSetService.deleteRuleSet(tenantId, id);
        return ApiResponse.success(null);
    }

    @PostMapping("/{id}/rules")
    public ApiResponse<ComplianceRuleSetDto> addRules(
            @PathVariable UUID id,
            @RequestBody List<CreateRuleSetRequest.RuleSetRuleEntry> entries,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleSetDto dto = ruleSetService.addRulesToRuleSet(tenantId, id, entries);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{id}/rules/{revisionId}")
    public ApiResponse<ComplianceRuleSetDto> removeRule(
            @PathVariable UUID id,
            @PathVariable UUID revisionId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceRuleSetDto dto = ruleSetService.removeRuleFromRuleSet(tenantId, id, revisionId);
        return ApiResponse.success(dto);
    }
}