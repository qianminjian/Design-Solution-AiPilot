package com.platform.core.cde.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 文档分页查询请求（对齐 cde.contract.ts §ListDocumentsRequest）
 *
 * @param page      页码（从 1 开始）
 * @param pageSize  每页条数（上限 100）
 * @param sort      排序字段（默认 createdAt）
 * @param order     排序方向 asc / desc
 * @param status    文档状态过滤
 * @param keyword   名称模糊查询
 */
public record ListDocumentsRequest(
        @Min(value = 1, message = "page 须 ≥ 1")
        Integer page,

        @Min(value = 1, message = "pageSize 须 ≥ 1")
        @Max(value = 100, message = "pageSize 须 ≤ 100")
        Integer pageSize,

        String sort,

        String order,

        String status,

        String keyword
) {
}
