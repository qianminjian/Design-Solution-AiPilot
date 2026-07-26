package com.platform.core.common.response;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BusinessException 单元测试
 *
 * 覆盖：
 * - 双参构造（默认 422 状态码）
 * - 三参构造（自定义 HTTP 状态码）
 * - 异常继承链
 */
@DisplayName("BusinessException 业务异常")
class BusinessExceptionTest {

    @Nested
    @DisplayName("双参构造 BusinessException(code, message)")
    class TwoArgConstructor {

        @Test
        @DisplayName("应默认使用 422 UNPROCESSABLE_ENTITY 状态码")
        void shouldDefaultToUnprocessableEntity() {
            BusinessException ex = new BusinessException(ErrorCode.BUSINESS_RULE_VIOLATION, "操作被拒绝");

            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        }

        @Test
        @DisplayName("应正确设置 errorCode")
        void shouldSetErrorCode() {
            BusinessException ex = new BusinessException(ErrorCode.PRINCIPAL_NOT_FOUND, "主体不存在");

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应正确设置 message")
        void shouldSetMessage() {
            BusinessException ex = new BusinessException(ErrorCode.NOT_FOUND, "资源未找到");

            assertThat(ex.getMessage()).isEqualTo("资源未找到");
        }
    }

    @Nested
    @DisplayName("三参构造 BusinessException(code, httpStatus, message)")
    class ThreeArgConstructor {

        @Test
        @DisplayName("应使用自定义 HTTP 状态码 404")
        void shouldUseCustomHttpStatus404() {
            BusinessException ex = new BusinessException(
                    ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "资源未找到"
            );

            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("应使用自定义 HTTP 状态码 401")
        void shouldUseCustomHttpStatus401() {
            BusinessException ex = new BusinessException(
                    ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, "未登录"
            );

            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("应使用自定义 HTTP 状态码 403")
        void shouldUseCustomHttpStatus403() {
            BusinessException ex = new BusinessException(
                    ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, "无权限"
            );

            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("应使用自定义 HTTP 状态码 409")
        void shouldUseCustomHttpStatus409() {
            BusinessException ex = new BusinessException(
                    ErrorCode.PRINCIPAL_ALREADY_EXISTS, HttpStatus.CONFLICT, "主体已存在"
            );

            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
        }

        @Test
        @DisplayName("应正确设置 errorCode 和 message")
        void shouldSetErrorCodeAndMessage() {
            BusinessException ex = new BusinessException(
                    ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED, "token 无效"
            );

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TOKEN_INVALID);
            assertThat(ex.getMessage()).isEqualTo("token 无效");
        }
    }

    @Nested
    @DisplayName("异常继承链")
    class ExceptionInheritance {

        @Test
        @DisplayName("应是 RuntimeException 子类")
        void shouldBeRuntimeException() {
            BusinessException ex = new BusinessException(ErrorCode.INTERNAL_ERROR, "内部错误");

            assertThat(ex).isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("应是 Exception 子类")
        void shouldBeException() {
            BusinessException ex = new BusinessException(ErrorCode.INTERNAL_ERROR, "内部错误");

            assertThat(ex).isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("应可被 catch(RuntimeException) 捕获")
        void shouldBeCatchableAsRuntimeException() {
            try {
                throw new BusinessException(ErrorCode.BUSINESS_RULE_VIOLATION, "操作被拒绝");
            } catch (RuntimeException ex) {
                assertThat(ex).isInstanceOf(BusinessException.class);
                assertThat(((BusinessException) ex).getErrorCode()).isEqualTo(ErrorCode.BUSINESS_RULE_VIOLATION);
            }
        }
    }
}
