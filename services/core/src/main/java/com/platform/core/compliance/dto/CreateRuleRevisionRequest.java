package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record CreateRuleRevisionRequest(
        @NotBlank(message = "DSL JSON 不能为空")
        String dslJson,

        Map<String, Object> parametersJson,

        Map<String, Object> basis,

        String engineProfile,

        String changeNote
) {
}