package com.platform.core.design.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.design.domain.DesignDiscipline;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.dto.CreateDesignOptionRequest;
import com.platform.core.design.dto.DesignFeedbackDto;
import com.platform.core.design.dto.DesignFeedbackRequest;
import com.platform.core.design.dto.DesignOptionDto;
import com.platform.core.design.service.DesignFeedbackService;
import com.platform.core.design.service.DesignOptionService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 设计选项 API
 *
 * V0 裁剪范围：list + create + get + feedback submit + feedback list
 */
@RestController
@RequestMapping("/api/v1/design-options")
public class DesignOptionController {

    private final DesignOptionService optionService;
    private final DesignFeedbackService feedbackService;

    public DesignOptionController(DesignOptionService optionService,
                                   DesignFeedbackService feedbackService) {
        this.optionService = optionService;
        this.feedbackService = feedbackService;
    }

    @GetMapping
    public PageResponse<DesignOptionDto> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID projectId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) DesignOptionStatus status,
            @RequestParam(required = false) DesignDiscipline discipline) {
        Page<DesignOptionDto> result = optionService.list(tenantId, projectId, status, discipline, page, pageSize);
        return PageResponse.success(result.getContent(), result.getTotalElements(), page, pageSize);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DesignOptionDto> create(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestBody @Valid CreateDesignOptionRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(optionService.create(tenantId, request, userId));
    }

    @GetMapping("/{optionId}")
    public ApiResponse<DesignOptionDto> get(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID optionId) {
        return ApiResponse.success(optionService.get(tenantId, optionId));
    }

    @PostMapping("/{optionId}/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DesignFeedbackDto> submitFeedback(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID optionId,
            @RequestBody @Valid DesignFeedbackRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(feedbackService.submit(tenantId, optionId, request, userId));
    }

    @GetMapping("/{optionId}/feedback")
    public ApiResponse<List<DesignFeedbackDto>> listFeedback(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID optionId) {
        return ApiResponse.success(feedbackService.listByOption(tenantId, optionId));
    }
}
