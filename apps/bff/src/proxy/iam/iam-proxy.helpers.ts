import { Request } from "express";
import { Method } from "axios";
import type { ZodType } from "zod";
import { HttpHeader } from "@design-platform/shared";
import { ProxyResult } from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * IAM 代理通用辅助函数与类型
 * 抽离各 IAM 域 controller 的重复逻辑（请求体提取、转发头组装、query 归一化、schema 匹配验证）
 */

/** Schema 匹配规则 */
export interface SchemaMatchRule {
  /** HTTP 方法大写 */
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** path 正则（不含 query string） */
  pathRegex: RegExp;
  /** 对应 schema */
  schema: ZodType<unknown>;
  /** 操作名（用于日志关联） */
  operation: string;
}

/** 提取请求体：GET/HEAD/DELETE 无请求体，其他方法透传 request.body */
export function extractBody(request: Request): unknown {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "DELETE") {
    return undefined;
  }
  return request.body;
}

/** 提取需要转发到下游 Core Service 的请求头（含认证、租户、追踪、幂等等关键 header） */
export function extractForwardHeaders(
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

  if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
    headers[HttpHeader.X_TRACE_ID] = request.traceId;
  }

  return headers;
}

/** 归一化 query 参数：仅保留 string 与 string[]，避免透传 ParsedQs 给 axios */
export function normalizeQuery(
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

/** 按规则列表匹配 path，返回首个匹配项；未匹配返回 null */
function matchSchema(
  rules: readonly SchemaMatchRule[],
  request: Request,
): SchemaMatchRule | null {
  const upperMethod = request.method.toUpperCase();
  const pathOnly = (request.originalUrl.split("?")[0] ?? "").trim();
  return (
    rules.find(
      (rule) => rule.method === upperMethod && rule.pathRegex.test(pathOnly),
    ) ?? null
  );
}

/** 通用严格验证：按规则匹配 schema，对响应业务数据校验；列表响应（数组）跳过 */
function validateByRules(
  result: ProxyResult,
  request: Request,
  rules: readonly SchemaMatchRule[],
  schemaValidator: SchemaValidator,
  domain = "iam",
): void {
  const match = matchSchema(rules, request);
  if (!match) {
    return;
  }

  const businessData = schemaValidator.extractBusinessData(result);
  if (Array.isArray(businessData)) {
    return;
  }

  const validated = schemaValidator.validateStrict(businessData, match.schema, {
    domain,
    operation: match.operation,
    traceId: request.traceId,
    downstreamService: "core-service",
  });
  schemaValidator.writeBackBusinessData(result, validated);
}

/** 通用代理转发：forward + 2xx 时严格验证（按规则列表） */
export async function proxyWithValidation(
  request: Request,
  proxyService: ProxyService,
  schemaValidator: SchemaValidator,
  rules: readonly SchemaMatchRule[],
  domain = "iam",
): Promise<ProxyResult> {
  const result = await proxyService.forward({
    method: request.method as Method,
    path: request.originalUrl,
    body: extractBody(request),
    headers: extractForwardHeaders(request),
    query: normalizeQuery(request.query),
  });

  if (result.status >= 200 && result.status < 300) {
    validateByRules(result, request, rules, schemaValidator, domain);
  }

  return result;
}
