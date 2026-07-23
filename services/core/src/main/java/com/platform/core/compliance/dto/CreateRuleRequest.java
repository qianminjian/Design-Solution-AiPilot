package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public record CreateRuleRequest(
        @NotBlank(message = "规则编码不能为空")
        @Size(max = 100, message = "规则编码长度不能超过 100")
        String ruleCode,

        @NotBlank(message = "规则名称不能为空")
        @Size(max = 255, message = "规则名称长度不能超过 255")
        String name,

        @NotBlank(message = "规则类别不能为空")
        String category,

        UUID owner,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        Map<String, Object> basis
) {
}