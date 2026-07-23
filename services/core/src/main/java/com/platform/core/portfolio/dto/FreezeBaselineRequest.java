package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * 冻结基线请求（对齐 portfolio.contract.ts §FreezeBaselineRequest）
 *
 * @param name        基线名称
 * @param description 描述
 * @param metadata    元数据 JSONB
 */
public record FreezeBaselineRequest(
        @NotBlank(message = "基线名称不能为空")
        @Size(max = 255, message = "基线名称长度不能超过 255")
        String name,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        Map<String, Object> metadata
) {
}
