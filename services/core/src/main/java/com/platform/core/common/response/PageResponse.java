package com.platform.core.common.response;

import org.slf4j.MDC;

import java.util.List;

/**
 * 分页响应格式
 *
 * @param code     业务码
 * @param data     分页数据
 * @param message  提示信息
 * @param traceId  全链路追踪 ID
 */
public record PageResponse<T>(
        int code,
        PageData<T> data,
        String message,
        String traceId
) {

    /**
     * 构造成功分页响应
     */
    public static <T> PageResponse<T> success(List<T> list, long total, int page, int pageSize) {
        boolean hasMore = (long) page * pageSize < total;
        PageData<T> data = new PageData<>(list, total, page, pageSize, hasMore);
        return new PageResponse<>(ApiResponse.SUCCESS_CODE, data, null, MDC.get("traceId"));
    }

    /**
     * 分页数据载体
     *
     * @param list      数据列表
     * @param total     总记录数
     * @param page      当前页码（从 1 开始）
     * @param pageSize  每页条数
     * @param hasMore   是否有下一页
     */
    public record PageData<T>(
            List<T> list,
            long total,
            int page,
            int pageSize,
            boolean hasMore
    ) {
    }
}
