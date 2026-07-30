package com.platform.core.compliance.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record CreateRuleRevisionRequest(
        @NotBlank(message = "DSL JSON 不能为空")
        String dslJson,

        Map<String, Object> parametersJson,

        // basis 在数据库为 TEXT 列，接受规范依据字符串（如 "ISO 19650 / NFPA 101"）
        String basis,

        String engineProfile,

        String changeNote
) {
}