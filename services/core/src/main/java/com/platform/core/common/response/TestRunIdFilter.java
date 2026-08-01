package com.platform.core.common.response;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * 测试运行 ID 过滤器（P0-1.2 测试数据隔离）
 *
 * 设计原则：
 *  - 优先级低于 TraceIdFilter（在 traceId 之后注入，便于关联日志）
 *  - 从请求头 x-test-run-id 读取 testRunId（BFF 透传）
 *  - 请求头缺失时，从环境变量 TEST_RUN_ID 兜底（local-dev=untracked / CI=run_id-attempt）
 *  - 格式校验：UUIDv4 / GitHub Actions run_id-run_attempt / "untracked"
 *  - 非法格式容错：视为 untracked，避免阻断请求
 *  - MDC 清理：finally 块清理 ThreadLocal 防内存泄漏
 *
 * 用途：
 *  - AuditLogInterceptor 从 MDC 读取 testRunId，写入 governance.audit_log.test_run_id 字段
 *  - SLO 报表查询 WHERE test_run_id IS NULL OR test_run_id = 'untracked' 排除测试数据
 *  - CI 流水线清理 DELETE WHERE test_run_id = ? 删除测试数据
 *
 * 权威源：@design/D43-SLO-运营报表.md §测试数据排除规则
 *         + .trae/rules/testing.md §Mock 规范
 *         + BEACON.md A-67 P0-1.2 测试数据隔离
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class TestRunIdFilter extends OncePerRequestFilter {

    /** HTTP Header 名（与 HttpHeader.X_TEST_RUN_ID 一致，避免循环依赖不引用 shared 包） */
    public static final String TEST_RUN_ID_HEADER = "x-test-run-id";

    /** MDC key（与 packages/shared TEST_RUN_ID_MDC_KEY 一致） */
    public static final String MDC_TEST_RUN_ID = "testRunId";

    /** 默认值：未标记（生产或本地开发场景） */
    public static final String UNTRACKED_TEST_RUN_ID = "untracked";

    /** 环境变量名（CI 流水线注入） */
    public static final String ENV_TEST_RUN_ID = "TEST_RUN_ID";

    /** testRunId 最大长度（与数据库 VARCHAR(64) 一致） */
    private static final int MAX_LENGTH = 64;

    /** UUIDv4 正则（不区分大小写） */
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", Pattern.CASE_INSENSITIVE);

    /** GitHub Actions run_id-run_attempt 格式（如 1234567890-1） */
    private static final Pattern GITHUB_RUN_PATTERN =
            Pattern.compile("^[0-9]+-[0-9]+$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // 1. 优先从请求头读取（BFF 透传，允许同一 Core 实例处理不同 testRunId 的请求）
        String testRunId = request.getHeader(TEST_RUN_ID_HEADER);

        // 2. 请求头缺失时，从环境变量兜底（local-dev=untracked / CI=run_id-attempt）
        if (testRunId == null || testRunId.isBlank()) {
            testRunId = System.getenv(ENV_TEST_RUN_ID);
        }

        // 3. 环境变量也缺失时，使用默认值 untracked
        if (testRunId == null || testRunId.isBlank()) {
            testRunId = UNTRACKED_TEST_RUN_ID;
        } else {
            testRunId = testRunId.trim();
            // 4. 格式校验：非法格式容错为 untracked，避免阻断请求
            if (!isValidTestRunId(testRunId)) {
                logger.debug("Invalid testRunId format, fallback to untracked: " + testRunId);
                testRunId = UNTRACKED_TEST_RUN_ID;
            }
        }

        // 5. 写入 MDC，供 AuditLogInterceptor 读取
        MDC.put(MDC_TEST_RUN_ID, testRunId);

        try {
            chain.doFilter(request, response);
        } finally {
            // 6. 清理 MDC 防 ThreadLocal 内存泄漏
            MDC.remove(MDC_TEST_RUN_ID);
        }
    }

    /**
     * 校验 testRunId 格式
     *
     * 接受的格式：
     *  - "untracked"（默认值）
     *  - UUIDv4
     *  - GitHub Actions run_id-run_attempt 格式
     *
     * @param value 待校验的 testRunId
     * @return 是否合法
     */
    private boolean isValidTestRunId(String value) {
        if (value == null || value.isEmpty() || value.length() > MAX_LENGTH) {
            return false;
        }
        if (UNTRACKED_TEST_RUN_ID.equals(value)) {
            return true;
        }
        if (UUID_PATTERN.matcher(value).matches()) {
            return true;
        }
        return GITHUB_RUN_PATTERN.matcher(value).matches();
    }
}
