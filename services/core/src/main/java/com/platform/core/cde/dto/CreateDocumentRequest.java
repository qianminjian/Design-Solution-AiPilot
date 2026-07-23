package com.platform.core.cde.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 创建文档请求（对齐 cde.contract.ts §CreateDocumentRequest）
 *
 * <p>核心校验：
 * <ul>
 *   <li>name/path/mimeType/storageKey/checksum 非空</li>
 *   <li>checksum 长度 = 64（SHA-256 hex）</li>
 *   <li>sizeBytes ≥ 0</li>
 * </ul>
 */
public record CreateDocumentRequest(
        @NotBlank(message = "文档名称不能为空")
        @Size(max = 500, message = "文档名称长度不能超过 500")
        String name,

        @NotBlank(message = "文档路径不能为空")
        @Size(max = 1000, message = "文档路径长度不能超过 1000")
        String path,

        @NotBlank(message = "MIME 类型不能为空")
        @Size(max = 200, message = "MIME 类型长度不能超过 200")
        String mimeType,

        @PositiveOrZero(message = "文件大小必须 ≥ 0")
        Long sizeBytes,

        @NotBlank(message = "对象存储 Key 不能为空")
        @Size(max = 1000, message = "storageKey 长度不能超过 1000")
        String storageKey,

        @NotBlank(message = "校验和不能为空")
        @Size(min = 64, max = 64, message = "checksum 必须为 64 位 SHA-256 hex")
        String checksum,

        @Size(max = 2000, message = "版本说明长度不能超过 2000")
        String comment
) {
}
