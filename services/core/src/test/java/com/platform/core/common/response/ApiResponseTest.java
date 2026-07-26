package com.platform.core.common.response;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ApiResponse 单元测试
 *
 * 覆盖：
 * - success/error 工厂方法
 * - SUCCESS_CODE 常量
 * - traceId 从 MDC 读取（含 null 场景）
 * - record 不可变性
 */
@DisplayName("ApiResponse 统一响应格式")
class ApiResponseTest {

    private static final String TEST_TRACE_ID = "trace-test-123";

    @BeforeEach
    void setUp() {
        MDC.put(TraceIdFilter.MDC_TRACE_ID, TEST_TRACE_ID);
    }

    @AfterEach
    void tearDown() {
        MDC.remove(TraceIdFilter.MDC_TRACE_ID);
    }

    @Nested
    @DisplayName("success(data) 工厂方法")
    class SuccessFactory {

        @Test
        @DisplayName("应设置 code=0、data=传入值、message=null、traceId 从 MDC 读取")
        void shouldSetSuccessCodeAndData() {
            ApiResponse<String> response = ApiResponse.success("hello");

            assertThat(response.code()).isEqualTo(ApiResponse.SUCCESS_CODE);
            assertThat(response.data()).isEqualTo("hello");
            assertThat(response.message()).isNull();
            assertThat(response.traceId()).isEqualTo(TEST_TRACE_ID);
        }

        @Test
        @DisplayName("应允许 data 为 null")
        void shouldAllowNullData() {
            ApiResponse<Void> response = ApiResponse.success(null);

            assertThat(response.code()).isZero();
            assertThat(response.data()).isNull();
        }

        @Test
        @DisplayName("应支持复杂对象 data")
        void shouldSupportComplexObjectData() {
            TestPayload payload = new TestPayload("alice", 30);
            ApiResponse<TestPayload> response = ApiResponse.success(payload);

            assertThat(response.data()).isEqualTo(payload);
        }
    }

    @Nested
    @DisplayName("success(data, message) 工厂方法")
    class SuccessWithMessageFactory {

        @Test
        @DisplayName("应设置 code=0、data、message、traceId")
        void shouldSetAllFields() {
            ApiResponse<String> response = ApiResponse.success("ok", "操作成功");

            assertThat(response.code()).isZero();
            assertThat(response.data()).isEqualTo("ok");
            assertThat(response.message()).isEqualTo("操作成功");
            assertThat(response.traceId()).isEqualTo(TEST_TRACE_ID);
        }

        @Test
        @DisplayName("应允许 message 为空字符串")
        void shouldAllowEmptyMessage() {
            ApiResponse<String> response = ApiResponse.success("ok", "");

            assertThat(response.message()).isEmpty();
        }
    }

    @Nested
    @DisplayName("error(code, message) 工厂方法")
    class ErrorFactory {

        @Test
        @DisplayName("应设置 code、data=null、message、traceId")
        void shouldSetErrorFields() {
            ApiResponse<Void> response = ApiResponse.error(ErrorCode.UNAUTHORIZED, "未登录");

            assertThat(response.code()).isEqualTo(ErrorCode.UNAUTHORIZED);
            assertThat(response.data()).isNull();
            assertThat(response.message()).isEqualTo("未登录");
            assertThat(response.traceId()).isEqualTo(TEST_TRACE_ID);
        }

        @Test
        @DisplayName("应支持任意业务错误码")
        void shouldSupportVariousErrorCodes() {
            ApiResponse<Void> r1 = ApiResponse.error(ErrorCode.PARAM_MISSING, "参数缺失");
            ApiResponse<Void> r2 = ApiResponse.error(ErrorCode.NOT_FOUND, "未找到");
            ApiResponse<Void> r3 = ApiResponse.error(ErrorCode.INTERNAL_ERROR, "内部错误");

            assertThat(r1.code()).isEqualTo(101);
            assertThat(r2.code()).isEqualTo(404);
            assertThat(r3.code()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("traceId 行为")
    class TraceIdBehavior {

        @Test
        @DisplayName("MDC 无 traceId 时返回 null")
        void shouldReturnNullWhenMdcEmpty() {
            MDC.remove(TraceIdFilter.MDC_TRACE_ID);

            ApiResponse<String> response = ApiResponse.success("data");

            assertThat(response.traceId()).isNull();
        }

        @Test
        @DisplayName("应使用 MDC 当前值")
        void shouldUseCurrentMdcValue() {
            String customTraceId = "custom-trace-id-456";
            MDC.put(TraceIdFilter.MDC_TRACE_ID, customTraceId);

            ApiResponse<String> response = ApiResponse.success("data");

            assertThat(response.traceId()).isEqualTo(customTraceId);
        }
    }

    @Nested
    @DisplayName("不可变 record 行为")
    class RecordBehavior {

        @Test
        @DisplayName("相同字段应相等")
        void shouldBeEqualWhenFieldsSame() {
            ApiResponse<String> r1 = ApiResponse.success("ok", "msg");
            ApiResponse<String> r2 = ApiResponse.success("ok", "msg");

            assertThat(r1).isEqualTo(r2);
            assertThat(r1.hashCode()).isEqualTo(r2.hashCode());
        }

        @Test
        @DisplayName("toString 应包含所有字段")
        void shouldIncludeAllFieldsInToString() {
            ApiResponse<String> response = ApiResponse.success("ok");

            String str = response.toString();
            assertThat(str).contains("code=0");
            assertThat(str).contains("data=ok");
            assertThat(str).contains("traceId=" + TEST_TRACE_ID);
        }
    }

    @Nested
    @DisplayName("SUCCESS_CODE 常量")
    class SuccessCodeConstant {

        @Test
        @DisplayName("SUCCESS_CODE 应为 0")
        void shouldBeZero() {
            assertThat(ApiResponse.SUCCESS_CODE).isZero();
        }
    }

    /**
     * 测试用复杂对象
     */
    private record TestPayload(String name, int age) {
    }
}
