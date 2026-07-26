package com.platform.core.common.response;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * GlobalExceptionHandler 单元测试
 *
 * 覆盖：
 * - 业务异常 → 4xx + 业务码
 * - 参数校验失败 → 400 + 102
 * - 参数类型不匹配 → 400 + 102
 * - 非法参数 → 400 + 102
 * - 未知异常 → 500
 */
@DisplayName("GlobalExceptionHandler 全局异常处理")
class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    /**
     * 构造 mock 请求
     */
    private HttpServletRequest mockRequest(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        return request;
    }

    @Nested
    @DisplayName("handleBusiness 业务异常")
    class HandleBusiness {

        @Test
        @DisplayName("应使用异常携带的 HTTP 状态码与业务码")
        void shouldUseBusinessExceptionStatusAndCode() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "资源未找到"
            );
            HttpServletRequest request = mockRequest("/api/v1/projects/999");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.NOT_FOUND);
            assertThat(response.getBody().message()).isEqualTo("资源未找到");
        }

        @Test
        @DisplayName("应默认使用 422 状态码（双参构造）")
        void shouldDefaultToUnprocessableEntity() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION, "操作被拒绝"
            );
            HttpServletRequest request = mockRequest("/api/v1/gates/1/decisions");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
        }

        @Test
        @DisplayName("应使用 401 状态码处理认证异常")
        void shouldHandleUnauthorized() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, "未登录"
            );
            HttpServletRequest request = mockRequest("/api/v1/auth/login");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.UNAUTHORIZED);
        }

        @Test
        @DisplayName("应使用 403 状态码处理权限异常")
        void shouldHandleForbidden() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, "无权限"
            );
            HttpServletRequest request = mockRequest("/api/v1/admin/users");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("应使用 409 状态码处理冲突异常")
        void shouldHandleConflict() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.PRINCIPAL_ALREADY_EXISTS, HttpStatus.CONFLICT, "主体已存在"
            );
            HttpServletRequest request = mockRequest("/api/v1/iam/principals");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.PRINCIPAL_ALREADY_EXISTS);
        }

        @Test
        @DisplayName("响应体 data 应为 null")
        void shouldReturnNullData() {
            // Arrange
            BusinessException ex = new BusinessException(
                    ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "资源未找到"
            );
            HttpServletRequest request = mockRequest("/api/v1/projects/999");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(ex, request);

            // Assert
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().data()).isNull();
        }
    }

    @Nested
    @DisplayName("handleValidation 参数校验失败")
    class HandleValidation {

        @Test
        @DisplayName("应返回 400 + 102 错误码")
        void shouldReturn400AndParamInvalidCode() {
            // Arrange
            MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
            org.springframework.validation.BindingResult bindingResult =
                    mock(org.springframework.validation.BindingResult.class);
            when(ex.getBindingResult()).thenReturn(bindingResult);
            when(bindingResult.getFieldErrors()).thenReturn(Collections.<FieldError>emptyList());
            HttpServletRequest request = mockRequest("/api/v1/auth/login");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleValidation(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.PARAM_INVALID);
        }

        @Test
        @DisplayName("应拼接多个字段错误信息")
        void shouldConcatenateFieldErrors() {
            // Arrange
            MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
            org.springframework.validation.BindingResult bindingResult =
                    mock(org.springframework.validation.BindingResult.class);
            FieldError fieldError1 = new FieldError("loginRequest", "email", "邮箱格式错误");
            FieldError fieldError2 = new FieldError("loginRequest", "password", "密码不能为空");
            when(ex.getBindingResult()).thenReturn(bindingResult);
            when(bindingResult.getFieldErrors()).thenReturn(java.util.List.of(fieldError1, fieldError2));
            HttpServletRequest request = mockRequest("/api/v1/auth/login");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleValidation(ex, request);

            // Assert
            assertThat(response.getBody().message())
                    .contains("email: 邮箱格式错误")
                    .contains("password: 密码不能为空");
        }

        @Test
        @DisplayName("无字段错误时应返回空字符串消息")
        void shouldReturnEmptyMessageWhenNoFieldErrors() {
            // Arrange
            MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
            org.springframework.validation.BindingResult bindingResult =
                    mock(org.springframework.validation.BindingResult.class);
            when(ex.getBindingResult()).thenReturn(bindingResult);
            when(bindingResult.getFieldErrors()).thenReturn(Collections.<FieldError>emptyList());
            HttpServletRequest request = mockRequest("/api/v1/auth/login");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleValidation(ex, request);

            // Assert
            assertThat(response.getBody().message()).isEmpty();
        }
    }

    @Nested
    @DisplayName("handleTypeMismatch 参数类型不匹配")
    class HandleTypeMismatch {

        @Test
        @DisplayName("应返回 400 + 102 错误码")
        void shouldReturn400AndParamInvalidCode() {
            // Arrange
            MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
            when(ex.getName()).thenReturn("id");
            HttpServletRequest request = mockRequest("/api/v1/projects/abc");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleTypeMismatch(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.PARAM_INVALID);
        }

        @Test
        @DisplayName("应包含参数名")
        void shouldIncludeParameterName() {
            // Arrange
            MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
            when(ex.getName()).thenReturn("projectId");
            HttpServletRequest request = mockRequest("/api/v1/projects/abc");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleTypeMismatch(ex, request);

            // Assert
            assertThat(response.getBody().message()).contains("projectId");
        }

        @Test
        @DisplayName("应包含类型不匹配描述")
        void shouldIncludeTypeMismatchDescription() {
            // Arrange
            MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
            when(ex.getName()).thenReturn("version");
            HttpServletRequest request = mockRequest("/api/v1/documents/xyz/versions/not-a-number");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleTypeMismatch(ex, request);

            // Assert
            assertThat(response.getBody().message()).contains("类型不匹配");
        }
    }

    @Nested
    @DisplayName("handleIllegal 非法参数")
    class HandleIllegal {

        @Test
        @DisplayName("应返回 400 + 102 错误码")
        void shouldReturn400AndParamInvalidCode() {
            // Arrange
            IllegalArgumentException ex = new IllegalArgumentException("参数超出范围");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleIllegal(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.PARAM_INVALID);
        }

        @Test
        @DisplayName("应使用异常的 message 作为响应消息")
        void shouldUseExceptionMessage() {
            // Arrange
            IllegalArgumentException ex = new IllegalArgumentException("项目编码格式错误");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleIllegal(ex, request);

            // Assert
            assertThat(response.getBody().message()).isEqualTo("项目编码格式错误");
        }

        @Test
        @DisplayName("异常 message 为 null 时应返回 null 消息")
        void shouldReturnNullMessageWhenExceptionMessageIsNull() {
            // Arrange
            IllegalArgumentException ex = new IllegalArgumentException();
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleIllegal(ex, request);

            // Assert
            assertThat(response.getBody().message()).isNull();
        }
    }

    @Nested
    @DisplayName("handleUnknown 未知异常")
    class HandleUnknown {

        @Test
        @DisplayName("应返回 500 + INTERNAL_ERROR 错误码")
        void shouldReturn500AndInternalErrorCode() {
            // Arrange
            Exception ex = new RuntimeException("数据库连接失败");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleUnknown(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.INTERNAL_ERROR);
        }

        @Test
        @DisplayName("应返回固定文案 '服务内部错误' 而非原始异常消息")
        void shouldReturnGenericMessageNotOriginal() {
            // Arrange
            Exception ex = new RuntimeException("敏感的内部异常细节");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleUnknown(ex, request);

            // Assert
            assertThat(response.getBody().message()).isEqualTo("服务内部错误");
            assertThat(response.getBody().message()).doesNotContain("敏感的内部异常细节");
        }

        @Test
        @DisplayName("应处理 NullPointerException")
        void shouldHandleNullPointerException() {
            // Arrange
            Exception ex = new NullPointerException("value is null");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleUnknown(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.INTERNAL_ERROR);
        }

        @Test
        @DisplayName("应处理 IOException 等受检异常")
        void shouldHandleCheckedException() {
            // Arrange
            Exception ex = new java.io.IOException("网络中断");
            HttpServletRequest request = mockRequest("/api/v1/documents/upload");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleUnknown(ex, request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody().code()).isEqualTo(ErrorCode.INTERNAL_ERROR);
            assertThat(response.getBody().message()).isEqualTo("服务内部错误");
        }

        @Test
        @DisplayName("响应体 data 应为 null")
        void shouldReturnNullData() {
            // Arrange
            Exception ex = new RuntimeException("内部错误");
            HttpServletRequest request = mockRequest("/api/v1/projects");

            // Act
            ResponseEntity<ApiResponse<Void>> response = handler.handleUnknown(ex, request);

            // Assert
            assertThat(response.getBody().data()).isNull();
        }
    }
}
