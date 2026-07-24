package com.platform.core.ai.controller;

import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.dto.SubmitReviewRequest;
import com.platform.core.ai.service.AiGenerationRecordService;
import com.platform.core.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AI 生成记录 API — 审计追溯 + 人工复核闭环
 *
 * 提供查询与创建能力：
 * - POST   /api/v1/ai-generation-records                  创建记录（AI Service 在生成方案后通过 BFF 转发）
 * - GET    /api/v1/ai-generation-records/{id}              查询详情
 * - GET    /api/v1/ai-generation-records                   按项目或设计选项查询
 * - POST   /api/v1/ai-generation-records/{id}/link         关联设计选项（接受候选时回填）
 * - GET    /api/v1/ai-generation-records/reviews/pending   查询项目内待人工复核记录（须声明在 /{id} 之前）
 * - PATCH  /api/v1/ai-generation-records/{id}/review       提交人工复核决策（AI 安全红线闭环）
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

    /**
     * 查询项目内待人工复核记录
     * 必须声明在 {@link #get(UUID, UUID)} 之前，避免 "reviews" 被解析为 UUID 路径变量。
     */
    @GetMapping("/reviews/pending")
    public ApiResponse<List<AiGenerationRecordDto>> listPendingReviews(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID projectId) {
        return ApiResponse.success(recordService.listPendingReviews(tenantId, projectId));
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

    /**
     * 提交人工复核决策（AI 安全红线闭环）
     *
     * 仅当 requiresHumanReview=true 且 reviewStatus=PENDING 时允许提交。
     * 风险等级 high/critical 须在 decisionContext 提供 secondReviewer 与 signer 信息。
     */
    @PatchMapping("/{id}/review")
    public ApiResponse<AiGenerationRecordDto> submitReview(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID id,
            @RequestBody @Valid SubmitReviewRequest request,
            @RequestHeader("X-User-Id") UUID reviewerId) {
        return ApiResponse.success(recordService.submitReview(tenantId, id, request, reviewerId));
    }
}
