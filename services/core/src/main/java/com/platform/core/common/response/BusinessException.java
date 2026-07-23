package com.platform.core.common.response;

import org.springframework.http.HttpStatus;

/**
 * 业务异常
 * 用于表达可预期的业务规则失败，HTTP 状态码使用 4xx
 * 系统级异常（5xx）不使用本类，由 Spring 默认机制处理
 */
public class BusinessException extends RuntimeException {

    private final int errorCode;
    private final HttpStatus httpStatus;

    /**
     * 构造业务异常
     *
     * @param errorCode    业务错误码（须在 design/r2-contract-catalog/ 注册）
     * @param httpStatus   HTTP 状态码（业务错误用 4xx）
     * @param message      错误消息
     */
    public BusinessException(int errorCode, HttpStatus httpStatus, String message) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    /**
     * 构造业务异常（默认 422 业务规则失败）
     */
    public BusinessException(int errorCode, String message) {
        this(errorCode, HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    public int getErrorCode() {
        return errorCode;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
