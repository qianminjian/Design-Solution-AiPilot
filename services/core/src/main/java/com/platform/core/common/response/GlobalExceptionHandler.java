package com.platform.core.common.response;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

/**
 * 全局异常处理
 * 将各类异常统一转换为 ApiResponse 格式，遵循双层状态码（HTTP + 业务码）
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 业务异常 → 4xx + 业务码
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex, HttpServletRequest request) {
        log.warn("业务异常 path={} code={} msg={}", request.getRequestURI(), ex.getErrorCode(), ex.getMessage());
        ApiResponse<Void> body = ApiResponse.error(ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.status(ex.getHttpStatus()).body(body);
    }

    /**
     * 参数校验失败 → 400 + 102
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败 path={} detail={}", request.getRequestURI(), detail);
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.PARAM_INVALID, detail);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * 路径/参数类型不匹配 → 400 + 102
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String msg = "参数 " + ex.getName() + " 类型不匹配";
        log.warn("参数类型不匹配 path={} name={}", request.getRequestURI(), ex.getName());
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.PARAM_INVALID, msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * 非法参数 → 400 + 102
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegal(IllegalArgumentException ex, HttpServletRequest request) {
        log.warn("非法参数 path={} msg={}", request.getRequestURI(), ex.getMessage());
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.PARAM_INVALID, ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * 未知异常 → 500
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnknown(Exception ex, HttpServletRequest request) {
        log.error("未处理异常 path={}", request.getRequestURI(), ex);
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.INTERNAL_ERROR, "服务内部错误");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    /**
     * 格式化字段错误
     */
    private String formatFieldError(FieldError fe) {
        return fe.getField() + ": " + fe.getDefaultMessage();
    }
}
