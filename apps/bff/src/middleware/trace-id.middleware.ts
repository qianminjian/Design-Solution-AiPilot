import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { HttpHeader } from "@design-platform/shared";
import { runRequestContext } from "../infra/request-context";

/**
 * 扩展 Express Request，附加 traceId 字段
 * 用于在控制器和服务之间共享 traceId
 */
declare module "express" {
  interface Request {
    /** 当前请求的 traceId（来自请求头或新建） */
    traceId: string;
  }
}

/**
 * traceId 传播中间件
 * - 优先从请求头 x-trace-id 读取
 * - 如果缺失则生成新的 UUID
 * - 在响应头回传 x-trace-id，便于客户端关联
 * - 同时写入 AsyncLocalStorage，让 logger 等下游模块自动注入 traceId 字段
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(HttpHeader.X_TRACE_ID);
    request.traceId = incoming && incoming.trim() ? incoming : randomUUID();

    response.setHeader(HttpHeader.X_TRACE_ID, request.traceId);

    // 将 traceId 写入 AsyncLocalStorage，使后续异步调用链中的 logger 自动注入 trace_id
    runRequestContext({ traceId: request.traceId }, () => next());
  }
}
