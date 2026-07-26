import { Injectable } from "@nestjs/common";
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

/**
 * 指标服务
 * - 集中管理 Prometheus Registry 与所有自定义指标
 * - 暴露 http/proxy/uptime/jwt 维度指标（observability.md §3.1 RED/USE）
 * - 默认开启 Node 进程级 USE 指标（CPU/内存/事件循环等）
 *
 * 基数防护（observability.md §3.3）：
 * - 禁止 user_id / session_id / request_id / trace_id 作为 label
 * - label 组合数控制在 100 以内
 */
@Injectable()
export class MetricsService {
  /** Prometheus 注册表（独立注册表，避免与其它 prom-client 用户共享默认 Registry） */
  private readonly registry: Registry;

  /** HTTP 请求总数（counter）：bff_http_requests_total{method, path, status} */
  readonly httpRequestsTotal: Counter;

  /** HTTP 请求耗时直方图（histogram）：bff_http_request_duration_seconds */
  readonly httpRequestDurationSeconds: Histogram;

  /** 代理调用下游服务总数（counter）：bff_proxy_calls_total{target, method, status} */
  readonly proxyCallsTotal: Counter;

  /** 代理调用下游服务耗时（histogram）：bff_proxy_call_duration_seconds */
  readonly proxyCallDurationSeconds: Histogram;

  /** 当前活跃 JWT 会话数（gauge）：bff_jwt_active_sessions */
  readonly jwtActiveSessions: Gauge;

  /** Schema 验证失败总数（counter）：bff_schema_validation_failures_total{domain, operation, mode} */
  readonly schemaValidationFailures: Counter<string>;

  /** Node 进程运行时长（gauge, 秒）：bff_node_process_uptime_seconds */
  readonly nodeProcessUptimeSeconds: Gauge;

  constructor() {
    this.registry = new Registry();

    // 暴露 Node 进程默认指标（CPU / 内存 / event loop / GC）
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: "bff_http_requests_total",
      help: "BFF 接收到的 HTTP 请求总数",
      labelNames: ["method", "path", "status"] as const,
      registers: [this.registry],
    });

    // 直方图 buckets 对应 SLO：1ms/5ms/25ms/100ms/250ms/1s/5s
    this.httpRequestDurationSeconds = new Histogram({
      name: "bff_http_request_duration_seconds",
      help: "BFF HTTP 请求耗时（秒）",
      labelNames: ["method", "path", "status"] as const,
      buckets: [0.001, 0.005, 0.025, 0.1, 0.25, 1, 5],
      registers: [this.registry],
    });

    this.proxyCallsTotal = new Counter({
      name: "bff_proxy_calls_total",
      help: "BFF 代理到下游服务的调用总数",
      labelNames: ["target", "method", "status"] as const,
      registers: [this.registry],
    });

    this.proxyCallDurationSeconds = new Histogram({
      name: "bff_proxy_call_duration_seconds",
      help: "BFF 代理到下游服务的调用耗时（秒）",
      labelNames: ["target", "method", "status"] as const,
      buckets: [0.005, 0.025, 0.1, 0.25, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.jwtActiveSessions = new Gauge({
      name: "bff_jwt_active_sessions",
      help: "当前活跃 JWT 会话数（gauge）",
      registers: [this.registry],
    });

    // Schema 验证失败计数器
    // 标签基数：domain ~10、operation ~30、mode 2 → 组合数受控
    // 用途：监控 BFF 与下游服务（Core/AI）的契约漂移趋势
    this.schemaValidationFailures = new Counter({
      name: "bff_schema_validation_failures_total",
      help: "BFF schema 验证失败总数（按 domain/operation/mode 聚合）",
      labelNames: ["domain", "operation", "mode"] as const,
      registers: [this.registry],
    });

    this.nodeProcessUptimeSeconds = new Gauge({
      name: "bff_node_process_uptime_seconds",
      help: "Node 进程运行时长（秒）",
      registers: [this.registry],
      // 每次 collect 拉取最新值即可，避免后台定时器
      collect() {
        this.set(process.uptime());
      },
    });
  }

  /**
   * 暴露 Prometheus 文本格式指标
   * 供 metrics 控制器返回给 Prometheus 抓取
   */
  async toText(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * 获取 Registry 引用（用于测试断言）
   */
  getRegistry(): Registry {
    return this.registry;
  }
}
