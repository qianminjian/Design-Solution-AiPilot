package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

public record CreateCheckRunRequest(
        @NotNull(message = "规则集 ID 不能为空")
        UUID ruleSetId,

        UUID projectId,

        Map<String, Object> parameters,

        String idempotencyKey
) {
}