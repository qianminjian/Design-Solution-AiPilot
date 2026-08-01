import { All, Controller, Inject, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";

/**
 * 运营中心代理控制器（D37.17）
 *
 * 端点 → Core Service（Java，已实现，路径对齐 @OperationsOverviewController /
 * @SloController / @QueueTaskController / @WorkerController /
 * @ConnectorController / @OperationsActionController）：
 *
 * Operations 概览（/api/v1/operations/overview）：
 *  - GET    /                                   Operations 概览统计
 *
 * SLO 目标（/api/v1/operations/slos）：
 *  - GET    /                                   SLO 列表（分页）
 *  - GET    /{id}                               SLO 详情
 *  - POST   /                                   创建 SLO 目标
 *  - PUT    /{id}                               更新 SLO 目标
 *
 * Queue 任务（/api/v1/operations/queue）：
 *  - GET    /                                   队列任务列表（分页 + 多过滤）
 *  - GET    /{id}                               队列任务详情
 *  - POST   /                                   创建队列任务
 *  - POST   /{id}/pause                         暂停任务
 *  - POST   /{id}/resume                        恢复任务
 *  - POST   /{id}/retry                         重试任务
 *  - POST   /{id}/cancel                        取消任务（不可逆）
 *
 * Worker（/api/v1/operations/workers）：
 *  - GET    /                                   Worker 列表（分页）
 *  - GET    /{id}                               Worker 详情
 *  - POST   /{id}/pause                         暂停 Worker
 *  - POST   /{id}/resume                        恢复 Worker
 *
 * Connector（/api/v1/operations/connectors）：
 *  - GET    /                                   连接器列表（分页）
 *  - GET    /{id}                               连接器详情
 *
 * Operations 主动作（/api/v1/operations/action）：
 *  - POST   /                                   主动作（isolate/retry/reconcile/failover/pause/resume/cancel）
 *
 * V0 策略：纯透传
 *  - BFF 仅做透传，由 Core Service 校验危险动作约束与影响预览
 *  - 后端非 2xx 响应原样透传（保留 errorCode/message/traceId）
 *
 * 安全红线（D37.17 §Operations 危险动作）：
 *  - isolate/retry/reconcile/failover 为危险动作
 *  - 必须传入 reason + impactPreviewAcknowledged + stepUpToken
 *  - 不可逆动作（cancel）需双人审批（V1 实现）
 *  - BFF 仅做透传，由 Core Service 校验危险动作约束与影响预览
 *
 * 特殊状态（D37.17 §Operations）：
 *  - unknown job：未知任务由前端显式标识
 *  - retry storm：重试风暴检测由 Core Service 上报
 *  - 数据驻留限制：跨 Region 操作由 Core Service 校验
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.17 + @design/D42-SLO-容量.md
 */
@Controller("v1/operations")
@UseInterceptors(ProxyInterceptor)
export class OperationsProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
  ) {}

  @All("*")
  async proxy(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: request.method as Method,
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 提取请求体：GET/HEAD/DELETE 无请求体，其他方法透传 request.body */
  private extractBody(request: Request): unknown {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      return undefined;
    }
    return request.body;
  }

  /** 提取需要转发到下游 Core Service 的请求头 */
  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      HttpHeader.AUTHORIZATION,
      HttpHeader.X_TENANT_ID,
      "x-user-id",
      HttpHeader.X_TRACE_ID,
      HttpHeader.IDEMPOTENCY_KEY,
      "content-type",
      HttpHeader.ACCEPT_LANGUAGE,
      HttpHeader.X_TEST_RUN_ID,
    ];

    for (const name of forwardHeaderNames) {
      const value = request.header(name);
      if (value !== undefined && value.length > 0) {
        headers[name] = value;
      }
    }

    // traceId fallback：若请求头未携带 x-trace-id，使用 BFF 生成的 traceId
    if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
      headers[HttpHeader.X_TRACE_ID] = request.traceId;
    }

    return headers;
  }

  /** 归一化 query 参数（过滤 undefined，保留 string 与 string[]） */
  private normalizeQuery(
    query: Request["query"],
  ): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query ?? {})) {
      if (typeof value === "string") {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
    return result;
  }
}
