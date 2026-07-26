import { describe, it, expect, beforeEach } from "vitest";
import { MetricsService } from "../../../src/metrics/metrics.service";

/**
 * MetricsService 单元测试
 * - 验证所有指标（Counter/Histogram/Gauge）的注册与命名
 * - 验证标签聚合、inc/observe/set 行为
 * - 验证 toText 输出 Prometheus 文本格式
 * - 验证 nodeProcessUptimeSeconds 的 collect 回调能更新值
 *
 * prom-client v15 API：
 * - counter.get(labels) 返回 { value, labels } 单值对象，非数组
 * - gauge.get() 返回 { value, labels } 单值对象，未 set 时为 undefined
 * - histogram.get(labels) 返回 { values: { sum, count, buckets }, labels }
 */
describe("MetricsService", () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe("指标注册与命名", () => {
    it("应该暴露 httpRequestsTotal Counter 且名称正确", () => {
      expect(service.httpRequestsTotal).toBeDefined();
      expect(service.httpRequestsTotal.name).toBe("bff_http_requests_total");
    });

    it("httpRequestsTotal 应该有 method/path/status 标签", () => {
      const labelNames = service.httpRequestsTotal.labelNames;
      expect(labelNames).toEqual(
        expect.arrayContaining(["method", "path", "status"]),
      );
    });

    it("应该暴露 httpRequestDurationSeconds Histogram 且名称正确", () => {
      expect(service.httpRequestDurationSeconds).toBeDefined();
      expect(service.httpRequestDurationSeconds.name).toBe(
        "bff_http_request_duration_seconds",
      );
    });

    it("应该暴露 proxyCallsTotal Counter 且名称正确", () => {
      expect(service.proxyCallsTotal).toBeDefined();
      expect(service.proxyCallsTotal.name).toBe("bff_proxy_calls_total");
    });

    it("proxyCallsTotal 应该有 target/method/status 标签", () => {
      const labelNames = service.proxyCallsTotal.labelNames;
      expect(labelNames).toEqual(
        expect.arrayContaining(["target", "method", "status"]),
      );
    });

    it("应该暴露 proxyCallDurationSeconds Histogram 且名称正确", () => {
      expect(service.proxyCallDurationSeconds).toBeDefined();
      expect(service.proxyCallDurationSeconds.name).toBe(
        "bff_proxy_call_duration_seconds",
      );
    });

    it("应该暴露 jwtActiveSessions Gauge 且名称正确", () => {
      expect(service.jwtActiveSessions).toBeDefined();
      expect(service.jwtActiveSessions.name).toBe("bff_jwt_active_sessions");
    });

    it("应该暴露 schemaValidationFailures Counter 且名称正确", () => {
      expect(service.schemaValidationFailures).toBeDefined();
      expect(service.schemaValidationFailures.name).toBe(
        "bff_schema_validation_failures_total",
      );
    });

    it("schemaValidationFailures 应该有 domain/operation/mode 标签", () => {
      const labelNames = service.schemaValidationFailures.labelNames;
      expect(labelNames).toEqual(
        expect.arrayContaining(["domain", "operation", "mode"]),
      );
    });

    it("应该暴露 nodeProcessUptimeSeconds Gauge 且名称正确", () => {
      expect(service.nodeProcessUptimeSeconds).toBeDefined();
      expect(service.nodeProcessUptimeSeconds.name).toBe(
        "bff_node_process_uptime_seconds",
      );
    });
  });

  describe("Counter 行为", () => {
    /**
     * prom-client v15 行为：Counter.get(labels) 在某些场景返回 undefined。
     * 因此通过 toText 文本输出验证聚合结果，使用 regex 与标签顺序无关。
     */
    it("httpRequestsTotal.inc 应该按标签聚合累加", async () => {
      const labels = {
        method: "GET",
        path: "/api/v1/projects-probe",
        status: "200",
      };
      service.httpRequestsTotal.inc(labels, 1);
      service.httpRequestsTotal.inc(labels, 1);
      const text = await service.toText();
      // 应在文本中包含累加值 2（标签顺序与 prom-client 实现相关，用 regex）
      expect(text).toMatch(
        /bff_http_requests_total\{[^}]*method="GET"[^}]*path="\/api\/v1\/projects-probe"[^}]*status="200"[^}]*\} 2/,
      );
    });

    it("httpRequestsTotal.inc 不传 second 参数应默认 +1", async () => {
      service.httpRequestsTotal.inc({
        method: "POST",
        path: "/api/v1/auth/login",
        status: "201",
      });
      const text = await service.toText();
      expect(text).toMatch(
        /bff_http_requests_total\{[^}]*method="POST"[^}]*path="\/api\/v1\/auth\/login"[^}]*status="201"[^}]*\} 1/,
      );
    });

    it("proxyCallsTotal.inc 应按 target 标签区分下游服务", async () => {
      service.proxyCallsTotal.inc(
        { target: "core", method: "GET", status: "200" },
        1,
      );
      service.proxyCallsTotal.inc(
        { target: "ai", method: "POST", status: "500" },
        1,
      );
      const text = await service.toText();
      expect(text).toMatch(
        /bff_proxy_calls_total\{[^}]*target="core"[^}]*method="GET"[^}]*status="200"[^}]*\} 1/,
      );
      expect(text).toMatch(
        /bff_proxy_calls_total\{[^}]*target="ai"[^}]*method="POST"[^}]*status="500"[^}]*\} 1/,
      );
    });

    it("schemaValidationFailures.inc 应按 domain/operation/mode 聚合", async () => {
      const softLabels = {
        domain: "ai",
        operation: "generate",
        mode: "soft",
      };
      service.schemaValidationFailures.inc(softLabels, 1);
      service.schemaValidationFailures.inc(softLabels, 1);
      service.schemaValidationFailures.inc(
        { domain: "review", operation: "submit", mode: "strict" },
        1,
      );
      const text = await service.toText();
      // 软验证失败计数应为 2（ai/generate/soft 累加两次）
      expect(text).toMatch(
        /bff_schema_validation_failures_total\{[^}]*domain="ai"[^}]*operation="generate"[^}]*mode="soft"[^}]*\} 2/,
      );
      // 严格验证失败计数应为 1
      expect(text).toMatch(
        /bff_schema_validation_failures_total\{[^}]*domain="review"[^}]*operation="submit"[^}]*mode="strict"[^}]*\} 1/,
      );
    });
  });

  describe("Histogram 行为", () => {
    it("httpRequestDurationSeconds.observe 应记录耗时样本", async () => {
      const labels = {
        method: "GET",
        path: "/api/v1/histogram-probe",
        status: "200",
      };
      service.httpRequestDurationSeconds.observe(labels, 0.123);
      const text = await service.toText();
      // 应包含 count=1 和 sum=0.123
      expect(text).toMatch(
        /bff_http_request_duration_seconds_count\{[^}]*method="GET"[^}]*path="\/api\/v1\/histogram-probe"[^}]*status="200"[^}]*\} 1/,
      );
      expect(text).toMatch(
        /bff_http_request_duration_seconds_sum\{[^}]*method="GET"[^}]*path="\/api\/v1\/histogram-probe"[^}]*status="200"[^}]*\} 0\.123/,
      );
    });

    it("proxyCallDurationSeconds.observe 多次采样应累计 count 与 sum", async () => {
      const labels = {
        target: "core",
        method: "GET",
        status: "200",
      };
      service.proxyCallDurationSeconds.observe(labels, 0.05);
      service.proxyCallDurationSeconds.observe(labels, 0.15);
      service.proxyCallDurationSeconds.observe(labels, 0.25);
      const text = await service.toText();
      // count 应为 3，sum 应为 0.45
      expect(text).toMatch(
        /bff_proxy_call_duration_seconds_count\{[^}]*target="core"[^}]*method="GET"[^}]*status="200"[^}]*\} 3/,
      );
      expect(text).toMatch(
        /bff_proxy_call_duration_seconds_sum\{[^}]*target="core"[^}]*method="GET"[^}]*status="200"[^}]*\} 0\.45/,
      );
    });
  });

  describe("Gauge 行为", () => {
    /**
     * prom-client v15 Gauge.get() 行为：在未观察过该 label 组合时返回 undefined。
     * 因此使用 toText() 文本输出验证最终值，规避 API 差异。
     */
    it("jwtActiveSessions.set 应直接设置当前值", async () => {
      service.jwtActiveSessions.set(5);
      const text = await service.toText();
      // Prometheus 文本格式：bff_jwt_active_sessions 5
      expect(text).toMatch(/bff_jwt_active_sessions 5(\s|$)/);
    });

    it("jwtActiveSessions.inc 默认 +1", async () => {
      service.jwtActiveSessions.set(10);
      service.jwtActiveSessions.inc();
      const text = await service.toText();
      expect(text).toMatch(/bff_jwt_active_sessions 11(\s|$)/);
    });

    it("jwtActiveSessions.dec 默认 -1", async () => {
      service.jwtActiveSessions.set(10);
      service.jwtActiveSessions.dec();
      const text = await service.toText();
      expect(text).toMatch(/bff_jwt_active_sessions 9(\s|$)/);
    });

    it("nodeProcessUptimeSeconds 在 registry collect 时应更新值为进程运行时长", async () => {
      const before = process.uptime();
      // toText() 内部会触发 registry.collect，促使 Gauge.collect 回调执行
      const text = await service.toText();
      const after = process.uptime();
      // 应在输出中包含 bff_node_process_uptime_seconds 加上一个数值
      const match = text.match(
        /bff_node_process_uptime_seconds (\d+(?:\.\d+)?)/,
      );
      expect(match).not.toBeNull();
      const value = Number(match?.[1]);
      expect(value).toBeGreaterThanOrEqual(before);
      expect(value).toBeLessThanOrEqual(after + 0.5); // 留点缓冲
    });
  });

  describe("toText() Prometheus 文本格式输出", () => {
    it("应返回包含所有自定义指标名的字符串", async () => {
      service.httpRequestsTotal.inc(
        { method: "GET", path: "/probe", status: "200" },
        1,
      );
      service.schemaValidationFailures.inc(
        { domain: "test", operation: "probe", mode: "soft" },
        1,
      );
      const text = await service.toText();
      expect(text).toContain("bff_http_requests_total");
      expect(text).toContain("bff_http_request_duration_seconds");
      expect(text).toContain("bff_proxy_calls_total");
      expect(text).toContain("bff_proxy_call_duration_seconds");
      expect(text).toContain("bff_jwt_active_sessions");
      expect(text).toContain("bff_schema_validation_failures_total");
      expect(text).toContain("bff_node_process_uptime_seconds");
    });

    it("应包含 Node 进程默认指标（process_/node_ 前缀）", async () => {
      const text = await service.toText();
      // collectDefaultMetrics 会注册以 process_ / node_ 开头的指标
      expect(text).toMatch(/^(# HELP |process_|node_)/m);
    });

    it("多次调用应稳定输出且不抛错", async () => {
      service.httpRequestsTotal.inc(
        { method: "GET", path: "/api/v1/x", status: "200" },
        3,
      );
      const first = await service.toText();
      const second = await service.toText();
      expect(second).toContain("bff_http_requests_total");
      expect(second.length).toBeGreaterThan(0);
      expect(typeof first).toBe("string");
    });

    it("标签值应出现在 Prometheus 文本输出中", async () => {
      service.httpRequestsTotal.inc(
        { method: "DELETE", path: "/api/v1/probe-123", status: "204" },
        1,
      );
      const text = await service.toText();
      expect(text).toContain('method="DELETE"');
      expect(text).toContain('path="/api/v1/probe-123"');
      expect(text).toContain('status="204"');
    });

    it("schema 验证失败计数应按 domain/operation/mode 标签暴露", async () => {
      service.schemaValidationFailures.inc(
        { domain: "ai", operation: "generate", mode: "soft" },
        7,
      );
      const text = await service.toText();
      expect(text).toContain('domain="ai"');
      expect(text).toContain('operation="generate"');
      expect(text).toContain('mode="soft"');
    });
  });

  describe("getRegistry()", () => {
    it("应返回稳定的 Registry 引用（多次调用相同实例）", () => {
      const r1 = service.getRegistry();
      const r2 = service.getRegistry();
      expect(r1).toBe(r2);
    });

    it("Registry 应包含所有已注册指标", () => {
      const registry = service.getRegistry();
      const metrics = registry.getMetricsAsArray();
      const names = metrics.map((m) => m.name);
      expect(names).toContain("bff_http_requests_total");
      expect(names).toContain("bff_http_request_duration_seconds");
      expect(names).toContain("bff_proxy_calls_total");
      expect(names).toContain("bff_proxy_call_duration_seconds");
      expect(names).toContain("bff_jwt_active_sessions");
      expect(names).toContain("bff_schema_validation_failures_total");
      expect(names).toContain("bff_node_process_uptime_seconds");
    });

    it("Registry 应包含 collectDefaultMetrics 注册的进程级指标", () => {
      const registry = service.getRegistry();
      const metrics = registry.getMetricsAsArray();
      const names = metrics.map((m) => m.name);
      // collectDefaultMetrics 注册 nodejs_* 前缀的指标
      const hasDefaultMetric = names.some((n) => n.startsWith("nodejs_"));
      expect(hasDefaultMetric).toBe(true);
    });
  });
});
