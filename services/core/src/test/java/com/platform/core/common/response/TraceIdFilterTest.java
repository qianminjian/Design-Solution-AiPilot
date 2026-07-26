package com.platform.core.common.response;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * TraceIdFilter 单元测试
 *
 * 覆盖：
 * - 从请求头读取 traceId
 * - 缺失时自动生成 UUID
 * - 写入 MDC 与响应头
 * - finally 清理 MDC（防止线程池污染）
 */
@DisplayName("TraceIdFilter 链路追踪过滤器")
class TraceIdFilterTest {

    private final TraceIdFilter filter = new TraceIdFilter();

    @BeforeEach
    void setUp() {
        MDC.remove(TraceIdFilter.MDC_TRACE_ID);
    }

    @AfterEach
    void tearDown() {
        MDC.remove(TraceIdFilter.MDC_TRACE_ID);
    }

    @Nested
    @DisplayName("从请求头读取 traceId")
    class ReadFromHeader {

        @Test
        @DisplayName("应使用请求头中的 traceId 写入响应头")
        void shouldUseHeaderTraceId() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "external-trace-123");
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = new CapturingFilterChain();

            filter.doFilterInternal(request, response, chain);

            assertThat(response.getHeader(TraceIdFilter.TRACE_ID_HEADER))
                    .isEqualTo("external-trace-123");
        }

        @Test
        @DisplayName("应支持自定义格式的 traceId")
        void shouldSupportCustomFormat() throws ServletException, IOException {
            String customTraceId = "abc-DEF-123_456";
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, customTraceId);
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, new NoOpFilterChain());

            assertThat(response.getHeader(TraceIdFilter.TRACE_ID_HEADER))
                    .isEqualTo(customTraceId);
        }
    }

    @Nested
    @DisplayName("缺失 traceId 时自动生成")
    class AutoGenerate {

        @Test
        @DisplayName("请求头缺失时应生成 UUID")
        void shouldGenerateUuidWhenMissing() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, new NoOpFilterChain());

            String generated = response.getHeader(TraceIdFilter.TRACE_ID_HEADER);
            assertThat(generated).isNotBlank();
            assertThatCode(() -> UUID.fromString(generated)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("请求头为空字符串时应生成 UUID")
        void shouldGenerateUuidWhenBlank() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "");
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, new NoOpFilterChain());

            String generated = response.getHeader(TraceIdFilter.TRACE_ID_HEADER);
            assertThat(generated).isNotBlank();
            assertThatCode(() -> UUID.fromString(generated)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("请求头为纯空白字符时应生成 UUID")
        void shouldGenerateUuidWhenWhitespace() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "   ");
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, new NoOpFilterChain());

            String generated = response.getHeader(TraceIdFilter.TRACE_ID_HEADER);
            assertThat(generated).isNotBlank();
            assertThatCode(() -> UUID.fromString(generated)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("两次调用应生成不同的 UUID")
        void shouldGenerateDifferentUuids() throws ServletException, IOException {
            MockHttpServletResponse response1 = new MockHttpServletResponse();
            filter.doFilterInternal(new MockHttpServletRequest(), response1, new NoOpFilterChain());
            String id1 = response1.getHeader(TraceIdFilter.TRACE_ID_HEADER);

            MockHttpServletResponse response2 = new MockHttpServletResponse();
            filter.doFilterInternal(new MockHttpServletRequest(), response2, new NoOpFilterChain());
            String id2 = response2.getHeader(TraceIdFilter.TRACE_ID_HEADER);

            assertThat(id1).isNotEqualTo(id2);
        }
    }

    @Nested
    @DisplayName("MDC 生命周期")
    class MdcLifecycle {

        @Test
        @DisplayName("chain 执行期间 MDC 应含 traceId")
        void shouldPopulateMdcDuringChain() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "mdc-test-trace");
            CapturingFilterChain chain = new CapturingFilterChain();

            filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

            // chain 在执行时应能从 MDC 读取到 traceId
            assertThat(chain.capturedTraceId).isEqualTo("mdc-test-trace");
        }

        @Test
        @DisplayName("chain 执行完毕后 MDC 应被清理")
        void shouldClearMdcAfterChain() throws ServletException, IOException {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "cleanup-test-trace");

            filter.doFilterInternal(request, new MockHttpServletResponse(), new NoOpFilterChain());

            // filter 的 finally 已执行 MDC.remove
            assertThat(MDC.get(TraceIdFilter.MDC_TRACE_ID)).isNull();
        }

        @Test
        @DisplayName("chain 抛异常后 MDC 也应被清理且异常透传")
        void shouldClearMdcEvenOnException() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "exception-test-trace");

            FilterChain throwingChain = (req, res) -> {
                throw new RuntimeException("chain 故意抛异常");
            };

            assertThatThrownBy(() ->
                    filter.doFilterInternal(request, new MockHttpServletResponse(), throwingChain)
            ).isInstanceOf(RuntimeException.class)
                    .hasMessage("chain 故意抛异常");

            // filter 的 finally 已执行 MDC.remove
            assertThat(MDC.get(TraceIdFilter.MDC_TRACE_ID)).isNull();
        }
    }

    /**
     * 捕获 chain 执行时的 MDC traceId 值
     */
    private static class CapturingFilterChain implements FilterChain {
        String capturedTraceId;

        @Override
        public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
            capturedTraceId = MDC.get(TraceIdFilter.MDC_TRACE_ID);
        }
    }

    /**
     * 空实现 FilterChain
     */
    private static class NoOpFilterChain implements FilterChain {
        @Override
        public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
            // no-op
        }
    }
}
