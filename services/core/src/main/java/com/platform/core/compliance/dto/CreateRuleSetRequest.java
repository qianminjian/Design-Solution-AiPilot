package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateRuleSetRequest(
        @NotBlank(message = "规则集名称不能为空")
        @Size(max = 255, message = "规则集名称长度不能超过 255")
        String name,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        String stageCode,

        List<RuleSetRuleEntry> rules
) {
    public record RuleSetRuleEntry(
            UUID revisionId,
            Integer priority
    ) {
    }
}