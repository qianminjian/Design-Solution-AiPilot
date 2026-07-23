package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.dto.CreateMembershipRequest;
import com.platform.core.iam.dto.MembershipDto;
import com.platform.core.iam.service.MembershipService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 成员关系 REST API
 * 路径：/api/v1/memberships
 */
@RestController
@RequestMapping("/api/v1/memberships")
public class MembershipController {

    private final MembershipService membershipService;
    private final TenantResolver tenantResolver;

    public MembershipController(MembershipService membershipService, TenantResolver tenantResolver) {
        this.membershipService = membershipService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 创建成员关系
     */
    @PostMapping
    public ResponseEntity<ApiResponse<MembershipDto>> create(
            @Valid @RequestBody CreateMembershipRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        MembershipDto dto = membershipService.createMembership(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 查询成员关系详情
     */
    @GetMapping("/{id}")
    public ApiResponse<MembershipDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        MembershipDto dto = membershipService.getMembership(tenantId, id);
        return ApiResponse.success(dto);
    }

    /**
     * 按主体查询成员关系列表
     */
    @GetMapping
    public ApiResponse<List<MembershipDto>> listByPrincipal(
            @RequestParam UUID principalId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<MembershipDto> list = membershipService.listByPrincipal(tenantId, principalId);
        return ApiResponse.success(list);
    }
}
