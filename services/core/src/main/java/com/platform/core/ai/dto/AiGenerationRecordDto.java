package com.platform.core.ai.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * AI 生成记录响应 DTO
 */
public record AiGenerationRecordDto(
    UUID id,
    UUID tenantId,
    UUID projectId,
    UUID designOptionId,
    String promptTemplate,
    Map<String, Object> variables,
    String renderedPrompt,
    String rawContent,
    Map<String, Object> candidates,
    String model,
    Map<String, Object> tokenUsage,
    String riskLevel,
    Map<String, Object> guardrailResult,
    Boolean requiresHumanReview,
    Integer latencyMs,
    String traceId,
    /** 人工复核状态：PENDING / APPROVED / REJECTED / RETURNED */
    String reviewStatus,
    UUID reviewerId,
    String reviewComment,
    Instant reviewedAt,
    Map<String, Object> reviewDecision,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt,
    Long rowVersion
) {}
