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
 * 变更域代理控制器（D37.16）
 *
 * 端点 → Core Service（Java，已实现，路径对齐 @ChangeRequestController /
 * @AffectedItemController / @TaskPlanItemController / @ClosureEvidenceController /
 * @ChangeOperationController）：
 *
 * ChangeRequest 主实体（/api/v1/changes）：
 *  - GET    /                                  列出变更请求
 *  - POST   /                                  创建变更请求
 *  - GET    /:id                               变更详情（含子实体）
 *  - PUT    /:id                               更新变更请求（草稿阶段）
 *  - DELETE /:id                               删除草稿
 *  - POST   /:id/submit-impact                 提交影响评估
 *  - POST   /:id/approve                       批准变更
 *  - POST   /:id/reject                        拒绝变更
 *  - POST   /:id/recall                        撤回变更
 *  - POST   /:id/verify-closure                验证关闭
 *
 * AffectedItem 子实体（/api/v1/changes/:changeId/affected-items）：
 *  - GET    /                                  受影响项列表
 *  - GET    /:itemId                           受影响项详情
 *  - POST   /                                  创建受影响项
 *  - PUT    /:itemId                           更新受影响项
 *  - DELETE /:itemId                           删除受影响项
 *  - POST   /:itemId:recheck                   重新检查受影响项
 *
 * TaskPlanItem 子实体（/api/v1/changes/:changeId/task-plans）：
 *  - GET    /                                  处置任务列表
 *  - GET    /:itemId                           处置任务详情
 *  - POST   /                                  创建处置任务
 *  - PUT    /:itemId                           更新处置任务
 *  - DELETE /:itemId                           删除处置任务
 *  - POST   /:generate                         生成处置任务（AI 辅助）
 *  - POST   /:itemId:start                     启动处置任务
 *
 * ClosureEvidence 子实体（/api/v1/changes/:changeId/closure-evidences）：
 *  - GET    /                                  关闭证据列表
 *  - GET    /:evidenceId                       关闭证据详情
 *  - POST   /                                  创建关闭证据
 *  - DELETE /:evidenceId                       删除关闭证据
 *  - POST   /:evidenceId:verify                验证关闭证据
 *
 * ChangeOperation 时间线（/api/v1/changes/:changeId/operations）：
 *  - GET    /                                  操作阶段时间线
 *
 * V0 策略：纯透传
 *  - 所有 GET/POST/PUT/DELETE 请求透传至 Core Service
 *  - 路径中冒号语法（:recheck/:verify/:start/:generate）由后端 Spring @PostMapping 原生支持
 *  - 不伪造数据，不解析业务字段
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险动作（approve/verify-closure/recall）需 stepUpToken
 *  - 由 Core Service 校验职责分离（批准人 ≠ 实施人 ≠ 关闭人）
 *  - BFF 仅做透传，不解析 stepUpToken
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.16 + @design/D35-API-事件契约.md
 */
@Controller("v1/changes")
@UseInterceptors(ProxyInterceptor)
export class ChangeProxyController {
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
