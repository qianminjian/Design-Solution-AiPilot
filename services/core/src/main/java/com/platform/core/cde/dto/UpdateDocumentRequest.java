package com.platform.core.cde.dto;

import jakarta.validation.constraints.Size;

/**
 * 更新文档请求（对齐 cde.contract.ts §UpdateDocumentRequest）
 *
 * <p>仅非 null 字段被更新；status 通过 checkout/checkin 流转，不在此处直接修改
 */
public record UpdateDocumentRequest(
        @Size(max = 500, message = "文档名称长度不能超过 500")
        String name,

        @Size(max = 1000, message = "文档路径长度不能超过 1000")
        String path,

        @Size(max = 200, message = "MIME 类型长度不能超过 200")
        String mimeType
) {
}
