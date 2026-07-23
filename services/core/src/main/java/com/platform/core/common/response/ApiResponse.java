package com.platform.core.common.response;

import org.slf4j.MDC;

/**
 * 统一响应格式（跨语言一致）
 * 业务码 0 表示成功，非 0 表示业务错误
 *
 * @param code     业务码，0 表示成功
 * @param data     响应数据
 * @param message  提示信息
 * @param traceId  全链路追踪 ID
 */
public record ApiResponse<T>(
        int code,
        T data,
        String message,
        String traceId
) {

    /** 业务成功码 */
    public static final int SUCCESS_CODE = 0;

    /**
     * 构造成功响应（无消息）
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(SUCCESS_CODE, data, null, currentTraceId());
    }

    /**
     * 构造成功响应（带消息）
     */
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(SUCCESS_CODE, data, message, currentTraceId());
    }

    /**
     * 构造错误响应
     */
    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, null, message, currentTraceId());
    }

    /**
     * 从 MDC 获取当前 traceId（无则返回 null）
     */
    private static String currentTraceId() {
        return MDC.get("traceId");
    }
}
