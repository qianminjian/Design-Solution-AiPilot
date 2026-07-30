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
 * 工程分析域代理控制器（D37.14 P10 工程分析运行与结果质量）
 *
 * 端点 → Core Service（Java，已实现，路径对齐 @AnalysisProblemController /
 * @AnalysisScenarioController / @SimulationRunController /
 * @AnalysisResultController / @SolverProfileController）：
 *
 * AnalysisProblem 主实体（/api/v1/analysis/problems）：
 *  - GET    /                                  列出工程分析问题
 *  - POST   /                                  创建工程分析问题（草稿）
 *  - GET    /{problemId}                       问题详情
 *  - PUT    /{problemId}                       更新问题（草稿阶段）
 *  - DELETE /{problemId}                       删除草稿
 *  - POST   /{problemId}/submit                提交就绪（DRAFT → READY）
 *  - POST   /{problemId}/invalidate            标记失效
 *  - GET    /{problemId}/mesh-quality          网格质量摘要
 *
 * AnalysisScenario 子实体（/api/v1/analysis/problems/{problemId}/scenarios）：
 *  - GET    /                                  场景列表
 *  - POST   /                                  创建场景
 *  - GET    /{scenarioId}                      场景详情
 *  - PUT    /{scenarioId}                      更新场景
 *  - DELETE /{scenarioId}                      删除场景
 *
 * SimulationRun 子实体（/api/v1/analysis/runs）：
 *  - GET    ?problemId=                        按问题查询运行列表
 *  - POST   /                                  创建运行（QUEUED）
 *  - GET    /{runId}                           运行详情
 *  - POST   /{runId}/cancel                    取消运行
 *  - POST   /{runId}/retry                     重试运行（未知状态触发 reconcile）
 *  - GET    /{runId}/timeline                  运行时间线
 *  - GET    /{runId}/convergence               收敛指标
 *  - GET    /{runId}/results                   运行结果列表
 *
 * AnalysisResult 子实体（/api/v1/analysis/results）：
 *  - GET    /{resultId}                        结果详情
 *  - GET    /{resultId}/quality                结果质量评估
 *  - POST   /{resultId}/quality-assessment     提交质量评估
 *  - POST   /{resultId}/impact-proposal        创建变更影响提案
 *  - POST   /{resultId}/supersede              标记结果被取代
 *
 * SolverProfile 配置（/api/v1/analysis/solver-profiles）：
 *  - GET    /                                  求解器配置列表
 *
 * V0 策略：纯透传
 *  - 所有 GET/POST/PUT/DELETE 请求透传至 Core Service
 *  - 后端非 2xx 响应原样透传（保留 errorCode/message/traceId）
 *  - BFF 仅做透传，不解析业务字段
 *
 * 安全红线（design-constraints.md §AI 安全红线 + D37.14 §主动作）：
 *  - 高风险动作（submit/invalidate/cancel/retry/impact-proposal）需 stepUpToken
 *  - 质量评估决策（ACCEPT_AS_REVISION/EXCEPTION）需注册师签章
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *  - BFF 仅做透传，不解析 stepUpToken，由 Core Service 校验
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.14 + @design/D35-API-事件契约.md
 */
@Controller("v1/analysis")
@UseInterceptors(ProxyInterceptor)
export class AnalysisProxyController {
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
