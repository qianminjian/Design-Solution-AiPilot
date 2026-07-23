import { AsyncLocalStorage } from "node:async_hooks";

/**
 * 请求上下文数据
 * - 通过 AsyncLocalStorage 在异步调用链中透传，避免显式传参
 * - 字段对齐 .trae/rules/observability.md §1.2 必含字段
 */
export interface RequestContext {
  /** 当前请求的 traceId（来自 x-trace-id 头或新生成） */
  traceId: string;
}

/**
 * 请求级 AsyncLocalStorage
 * - 在 TraceIdMiddleware 中通过 requestContext.run(...) 写入
 * - 在任意异步下游（Service / HttpService 调用 / Logger）中通过 get() 读取
 * - 跨 async 边界自动透传，无需手动传递 traceId
 *
 * 注意：NestJS 11 默认使用 express，express 4 仍为回调模型，
 * AsyncLocalStorage 在 promise/await 链中工作良好；
 * 如未来切换到 fastify 也兼容。
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * 在请求上下文中执行函数
 * @param ctx 请求上下文数据
 * @param callback 业务回调
 */
export function runRequestContext<T>(
  ctx: RequestContext,
  callback: () => T,
): T {
  return requestContextStorage.run(ctx, callback);
}

/**
 * 获取当前请求上下文
 * @returns 当前请求上下文；若不在请求上下文中则返回 undefined
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * 获取当前请求的 traceId
 * @returns traceId；若不在请求上下文中则返回 "anonymous"
 *
 * 用于 logger 在不显式传 traceId 的情况下自动注入 traceId 字段，
 * "anonymous" 语义对齐 observability.md §1.2 中未登录用户的占位值
 */
export function getCurrentTraceId(): string {
  return requestContextStorage.getStore()?.traceId ?? "anonymous";
}
