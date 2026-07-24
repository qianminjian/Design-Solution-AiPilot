package com.platform.core.ai.controller;

import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.service.AiGenerationRecordService;
import com.platform.core.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AI 生成记录 API — 审计追溯
 *
 * 提供查询与创建能力：
 * - POST   /api/v1/ai-generation-records            创建记录（AI Service 在生成方案后通过 BFF 转发）
 * - GET    /api/v1/ai-generation-records/{id}       查询详情
 * - GET    /api/v1/ai-generation-records             按项目或设计选项查询
 * - POST   /api/v1/ai-generation-records/{id}/link   关联设计选项（接受候选时回填）
 */
@RestController
@RequestMapping("/api/v1/ai-generation-records")
public class AiGenerationRecordController {

    private final AiGenerationRecordService recordService;

    public AiGenerationRecordController(AiGenerationRecordService recordService) {
        this.recordService = recordService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AiGenerationRecordDto> create(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestBody @Valid CreateAiGenerationRecordRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(recordService.create(tenantId, request, userId));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiGenerationRecordDto> get(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID id) {
        return ApiResponse.success(recordService.get(tenantId, id));
    }

    @GetMapping
    public ApiResponse<List<AiGenerationRecordDto>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID designOptionId) {
        if (designOptionId != null) {
            return ApiResponse.success(recordService.listByDesignOption(tenantId, designOptionId));
        }
        if (projectId != null) {
            return ApiResponse.success(recordService.listByProject(tenantId, projectId));
        }
        return ApiResponse.success(List.of());
    }

    @PostMapping("/{id}/link")
    public ApiResponse<AiGenerationRecordDto> linkDesignOption(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID id,
            @RequestParam UUID designOptionId) {
        return ApiResponse.success(recordService.linkDesignOption(tenantId, id, designOptionId));
    }
}
