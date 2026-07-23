package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 项目分页查询请求（对齐 portfolio.contract.ts §ListProjectsRequest）
 *
 * @param page      页码（从 1 开始）
 * @param pageSize  每页条数（上限 100）
 * @param sort      排序字段（默认 created_at）
 * @param order     排序方向 asc / desc
 * @param status    项目状态过滤（可空）
 * @param keyword   名称/编码模糊查询（可空）
 */
public record ListProjectsRequest(
        @Min(value = 1, message = "page 须 ≥ 1")
        Integer page,

        @Min(value = 1, message = "pageSize 须 ≥ 1")
        @Max(value = 100, message = "pageSize 须 ≤ 100")
        Integer pageSize,

        String sort,

        /** asc / desc，默认 desc */
        String order,

        /** 项目状态过滤 */
        String status,

        String keyword
) {
}
