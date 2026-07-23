package com.platform.core.cde.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 检入请求（对齐 cde.contract.ts §CheckinRequest）
 *
 * <p>检入后文档状态从 CHECKED_OUT 流转为 PUBLISHED，
 * 同时创建新版本（version_number 自动递增）
 */
public record CheckinRequest(
        @NotBlank(message = "检入说明不能为空")
        @Size(max = 2000, message = "检入说明长度不能超过 2000")
        String comment,

        @NotBlank(message = "对象存储 Key 不能为空")
        @Size(max = 1000, message = "storageKey 长度不能超过 1000")
        String storageKey,

        @NotBlank(message = "校验和不能为空")
        @Size(min = 64, max = 64, message = "checksum 必须为 64 位 SHA-256 hex")
        String checksum,

        @PositiveOrZero(message = "文件大小必须 ≥ 0")
        Long sizeBytes,

        @Size(max = 200, message = "MIME 类型长度不能超过 200")
        String mimeType
) {
}
