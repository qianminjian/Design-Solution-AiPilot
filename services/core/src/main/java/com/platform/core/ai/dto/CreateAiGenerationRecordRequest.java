package com.platform.core.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

/**
 * 创建 AI 生成记录请求
 *
 * 由 AI Service 在生成方案后通过 BFF 转发至 Core Service 落库，
 * 用于审计追溯与设计选项关联。
 */
public record CreateAiGenerationRecordRequest(
    @NotNull UUID projectId,
    UUID designOptionId,
    @NotBlank @Size(max = 128) String promptTemplate,
    Map<String, Object> variables,
    @NotBlank String renderedPrompt,
    @NotBlank String rawContent,
    @NotNull Map<String, Object> candidates,
    @NotBlank @Size(max = 64) String model,
    @NotNull Map<String, Object> tokenUsage,
    @NotBlank @Size(max = 16) String riskLevel,
    @NotNull Map<String, Object> guardrailResult,
    Boolean requiresHumanReview,
    Integer latencyMs,
    @Size(max = 64) String traceId
) {}
