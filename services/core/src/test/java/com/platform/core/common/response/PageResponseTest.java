package com.platform.core.common.response;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PageResponse 单元测试
 *
 * 覆盖：
 * - success 工厂方法
 * - hasMore 计算逻辑（边界值）
 * - PageData record
 * - traceId 行为
 */
@DisplayName("PageResponse 分页响应格式")
class PageResponseTest {

    private static final String TEST_TRACE_ID = "page-trace-789";

    @BeforeEach
    void setUp() {
        MDC.put(TraceIdFilter.MDC_TRACE_ID, TEST_TRACE_ID);
    }

    @AfterEach
    void tearDown() {
        MDC.remove(TraceIdFilter.MDC_TRACE_ID);
    }

    @Nested
    @DisplayName("success(list, total, page, pageSize) 工厂方法")
    class SuccessFactory {

        @Test
        @DisplayName("应设置 code=0、data、message=null、traceId")
        void shouldSetAllFields() {
            List<String> items = List.of("a", "b", "c");
            PageResponse<String> response = PageResponse.success(items, 100L, 1, 10);

            assertThat(response.code()).isZero();
            assertThat(response.message()).isNull();
            assertThat(response.traceId()).isEqualTo(TEST_TRACE_ID);
            assertThat(response.data().list()).containsExactly("a", "b", "c");
            assertThat(response.data().total()).isEqualTo(100L);
            assertThat(response.data().page()).isEqualTo(1);
            assertThat(response.data().pageSize()).isEqualTo(10);
            assertThat(response.data().hasMore()).isTrue();
        }

        @Test
        @DisplayName("空列表应被允许")
        void shouldAllowEmptyList() {
            PageResponse<String> response = PageResponse.success(List.of(), 0L, 1, 10);

            assertThat(response.data().list()).isEmpty();
            assertThat(response.data().total()).isZero();
        }
    }

    @Nested
    @DisplayName("hasMore 计算逻辑")
    class HasMoreCalculation {

        @Test
        @DisplayName("total > page * pageSize 时 hasMore=true")
        void shouldBeTrueWhenMoreData() {
            PageResponse<String> response = PageResponse.success(List.of("a"), 11L, 1, 10);

            assertThat(response.data().hasMore()).isTrue();
        }

        @Test
        @DisplayName("total = page * pageSize 时 hasMore=false（已到末页）")
        void shouldBeFalseWhenExactEnd() {
            PageResponse<String> response = PageResponse.success(List.of("a"), 10L, 1, 10);

            assertThat(response.data().hasMore()).isFalse();
        }

        @Test
        @DisplayName("total < page * pageSize 时 hasMore=false")
        void shouldBeFalseWhenLessThanEnd() {
            PageResponse<String> response = PageResponse.success(List.of("a"), 5L, 1, 10);

            assertThat(response.data().hasMore()).isFalse();
        }

        @Test
        @DisplayName("第 2 页：total=21, page=2, pageSize=10 时 hasMore=true")
        void shouldBeTrueOnSecondPage() {
            // 2 * 10 = 20 < 21
            PageResponse<String> response = PageResponse.success(List.of("a"), 21L, 2, 10);

            assertThat(response.data().hasMore()).isTrue();
        }

        @Test
        @DisplayName("第 3 页：total=30, page=3, pageSize=10 时 hasMore=false")
        void shouldBeFalseOnLastPage() {
            // 3 * 10 = 30 = total
            PageResponse<String> response = PageResponse.success(List.of("a"), 30L, 3, 10);

            assertThat(response.data().hasMore()).isFalse();
        }

        @Test
        @DisplayName("total=0 时 hasMore=false")
        void shouldBeFalseWhenTotalZero() {
            PageResponse<String> response = PageResponse.success(List.of(), 0L, 1, 10);

            assertThat(response.data().hasMore()).isFalse();
        }
    }

    @Nested
    @DisplayName("traceId 行为")
    class TraceIdBehavior {

        @Test
        @DisplayName("MDC 无 traceId 时返回 null")
        void shouldReturnNullWhenMdcEmpty() {
            MDC.remove(TraceIdFilter.MDC_TRACE_ID);

            PageResponse<String> response = PageResponse.success(List.of("a"), 1L, 1, 10);

            assertThat(response.traceId()).isNull();
        }
    }

    @Nested
    @DisplayName("PageData record")
    class PageDataRecord {

        @Test
        @DisplayName("应正确存储所有字段")
        void shouldStoreAllFields() {
            List<Integer> list = List.of(1, 2, 3);
            PageResponse.PageData<Integer> data = new PageResponse.PageData<>(list, 50L, 2, 20, true);

            assertThat(data.list()).isEqualTo(list);
            assertThat(data.total()).isEqualTo(50L);
            assertThat(data.page()).isEqualTo(2);
            assertThat(data.pageSize()).isEqualTo(20);
            assertThat(data.hasMore()).isTrue();
        }

        @Test
        @DisplayName("相同字段应相等")
        void shouldBeEqualWhenFieldsSame() {
            List<Integer> list = List.of(1, 2, 3);
            PageResponse.PageData<Integer> d1 = new PageResponse.PageData<>(list, 50L, 2, 20, true);
            PageResponse.PageData<Integer> d2 = new PageResponse.PageData<>(list, 50L, 2, 20, true);

            assertThat(d1).isEqualTo(d2);
            assertThat(d1.hashCode()).isEqualTo(d2.hashCode());
        }
    }
}
