package com.platform.core.compliance.dto;

import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public record UpdateRuleRequest(
        @Size(max = 255, message = "规则名称长度不能超过 255")
        String name,

        String category,

        UUID owner,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        Map<String, Object> basis,

        String status
) {
}