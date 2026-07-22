---
alwaysApply: false
description: 跨语言 API 统一约定——编辑 apps/bff/ 或 services/core/ 或 services/ai/ 时生效
globs: apps/bff/**, services/core/**, services/ai/**
---

# 跨语言 API 统一约定

> 来源：PrismScan L2-project 规则适配

## 适用范围

本规则适用于 BFF（NestJS 11）、核心业务服务（Java 21 + Spring Boot 3.4）、AI 服务（Python 3.12 + FastAPI）之间及对外的所有 HTTP API 设计与实现。

## 1. URL 设计

- 资源名使用复数 + kebab-case：`/api/v1/projects`、`/api/v1/design-revisions`。
- 嵌套层级 ≤ 2 层：`/api/v1/projects/{id}/revisions`。
- 版本号在 URL 路径前缀：`/api/v1/`。
- 禁止单数资源名：`/api/v1/project`（错误）→ `/api/v1/projects`（正确）。
- 禁止驼峰命名：`/api/v1/designRevisions`（错误）→ `/api/v1/design-revisions`（正确）。
- 禁止 3 层以上嵌套：`/api/v1/projects/{id}/revisions/{rid}/files/{fid}`（错误，改用独立资源 + 查询参数）。

```text
# 正确
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{id}
PUT    /api/v1/projects/{id}
DELETE /api/v1/projects/{id}
GET    /api/v1/projects/{id}/revisions        # 2 层嵌套

# 禁止
GET    /api/v1/project                         # 单数
GET    /api/v1/projects/{id}/revisions/{rid}/files/{fid}/versions  # 4 层嵌套
GET    /api/v1/designRevisions                 # 驼峰
```

## 2. 统一响应格式（跨语言一致）

所有 API 响应必须使用统一的 `ApiResponse<T>` 结构，三种语言实现保持字段一致。

### 2.1 TypeScript（NestJS BFF）

```typescript
/**
 * 统一响应格式
 */
interface ApiResponse<T> {
  code: number;          // 业务码，0 表示成功，非 0 表示业务错误
  data?: T;              // 响应数据，成功时必填
  message?: string;      // 提示信息，错误时必填
  traceId?: string;      // 全链路追踪 ID
}

/**
 * 分页响应格式
 */
interface PageResponse<T> {
  code: number;
  data: {
    list: T[];           // 数据列表
    total: number;       // 总记录数
    page: number;        // 当前页码（从 1 开始）
    pageSize: number;    // 每页条数
    hasMore: boolean;    // 是否有下一页
  };
  message?: string;
  traceId?: string;
}
```

### 2.2 Java（Spring Boot 核心服务）

```java
package com.platform.core.common.dto;

/**
 * 统一响应格式
 */
public record ApiResponse<T>(
    int code,           // 业务码，0 表示成功
    T data,             // 响应数据
    String message,     // 提示信息
    String traceId      // 全链路追踪 ID
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(0, data, null, MDC.get("traceId"));
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, null, message, MDC.get("traceId"));
    }
}

/**
 * 分页响应格式
 */
public record PageResponse<T>(
    int code,
    PageData<T> data,
    String message,
    String traceId
) {
    public record PageData<T>(
        java.util.List<T> list,
        long total,
        int page,
        int pageSize,
        boolean hasMore
    ) {}
}
```

### 2.3 Python（FastAPI AI 服务）

```python
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一响应格式"""

    code: int                    # 业务码，0 表示成功
    data: Optional[T] = None     # 响应数据
    message: Optional[str] = None  # 提示信息
    trace_id: Optional[str] = None  # 全链路追踪 ID


class PageData(BaseModel, Generic[T]):
    """分页数据"""

    list: list[T]               # 数据列表
    total: int                  # 总记录数
    page: int                   # 当前页码（从 1 开始）
    page_size: int              # 每页条数
    has_more: bool              # 是否有下一页


class PageResponse(BaseModel, Generic[T]):
    """分页响应格式"""

    code: int
    data: PageData[T]
    message: Optional[str] = None
    trace_id: Optional[str] = None
```

## 3. 双层状态码校验

- **HTTP 200 + `code === 0` 才算成功**。
- 业务错误使用 4xx + 业务码，禁止用 5xx 表示业务错误。
- 禁止 HTTP 200 + `{ code: 2001 }` 的混乱模式（HTTP 层成功但业务层失败）。

| 场景 | HTTP 状态码 | 响应体 code | 说明 |
|------|-----------|------------|------|
| 成功 | 200 | 0 | 请求处理成功 |
| 参数错误 | 400 | 100-199 | 请求参数校验失败 |
| 未登录 | 401 | 401 | 未携带或 token 失效 |
| 无权限 | 403 | 403 | 已登录但无权限 |
| 资源不存在 | 404 | 404 | 资源未找到 |
| 业务规则失败 | 422 | 422 | 设计文件未通过校审 / 版本冲突 |
| 限流 | 429 | 429 | 请求频率超限 |
| 服务端错误 | 500 | 500-599 | 内部异常（非业务错误） |

```typescript
// 正确：双层状态码
// 成功
return res.status(200).json({ code: 0, data: project, traceId: req.id });

// 业务错误（版本冲突）
return res.status(422).json({ code: 422, message: '版本冲突，请刷新后重试', traceId: req.id });

// 禁止：HTTP 200 + 业务错误码
// return res.status(200).json({ code: 422, message: '版本冲突' });
```

## 4. 业务错误码段

| 错误码段 | 含义 | 示例 |
|---------|------|------|
| 0 | 成功 | `{ code: 0, data: ... }` |
| 100-199 | 参数错误 | 101 参数缺失、102 参数格式错误、103 参数超出范围 |
| 401 | 未登录 | token 失效或未携带 |
| 403 | 无权限 | 无项目访问权限 |
| 404 | 资源不存在 | 项目 / 设计文件不存在 |
| 422 | 业务规则失败 | 设计文件未通过校审、版本冲突、状态不可变更 |
| 429 | 限流 | 请求频率超限 |
| 500-599 | 服务端错误 | 500 内部异常、503 服务不可用、599 下游超时 |

- 错误码段不跨段复用，新增错误码在对应段内递增。
- 错误码须在 `design/r2-contract-catalog/` 中注册并分配稳定 ID。

## 5. 版本控制

- 新增字段：向后兼容，无需升版本。
- 修改 / 删除字段：必须升 major 版本（`/api/v1/` → `/api/v2/`）。
- 同时维护 ≤ 2 个版本，旧版本 6 个月后下线。
- 下线通知通过响应头 `Sunset` 传递：

```text
# 弃用通知响应头
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: </api/v2/projects>; rel="successor-version"
```

- 弃用前 3 个月在响应头标注 `Deprecation: true`，并通知前端迁移。

## 6. 契约对齐

- API 路径与 `design/r2-contract-catalog/` 中分配的稳定 ID 保持一致。
- 修改 API 路径前先查阅契约目录，确认是否影响已注册的稳定 ID。
- 契约变更须走 ADR 决策流程（见 `design/decisions/`）。
- 设计文档与代码不一致时，默认代码缺失，不是设计过时。

## 7. traceId 全链路传播

- 每个请求生成唯一 `traceId`，贯穿 BFF → Core → AI 服务全链路。
- 响应头 `x-trace-id` 回传前端，前端可凭此查询问题。

| 服务 | 获取方式 | 传播方式 |
|------|---------|---------|
| NestJS BFF（TS） | `request.id` | 请求头 `x-trace-id` 传递给下游 |
| Spring Boot Core（Java） | `MDC.get("traceId")` | 请求头 `x-trace-id` 传递给下游 |
| FastAPI AI（Python） | `request.state.trace_id` | 请求头 `x-trace-id` 传递给下游 |

```typescript
// NestJS BFF：traceId 中间件
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
    req.id = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
  }
}
```

```java
// Spring Boot Core：traceId 过滤器
@Component
public class TraceIdFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        HttpServletRequest request = (HttpServletRequest) req;
        String traceId = request.getHeader("x-trace-id");
        if (traceId == null) {
            traceId = UUID.randomUUID().toString();
        }
        MDC.put("traceId", traceId);
        ((HttpServletResponse) res).setHeader("x-trace-id", traceId);
        chain.doFilter(req, res);
        MDC.clear();
    }
}
```

```python
# FastAPI AI：traceId 中间件
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["x-trace-id"] = trace_id
        return response
```

## 8. 第三方 API 集成红线

### 8.1 计费规则优先

- 调用付费 API 前，必须评估计费规则，优先使用免费 / 低成本方案。
- **禁止用付费 API 做另一个 API 的回退**（fallback）——付费 API 故障时应降级返回缓存或默认值，而非调用另一个付费 API。

```typescript
// 禁止：付费 API 互为 fallback
async function generateDesign(prompt: string) {
  try {
    return await openaiClient.generate(prompt);     // 付费
  } catch {
    return await claudeClient.generate(prompt);     // 禁止！又一个付费 API
  }
}

// 正确：付费 API 失败降级返回缓存
async function generateDesign(prompt: string) {
  try {
    return await openaiClient.generate(prompt);
  } catch {
    return getCachedDesign(prompt) ?? { degraded: true, message: 'AI 服务暂不可用' };
  }
}
```

### 8.2 双层状态码校验

- 调用第三方 API 须校验 HTTP 状态码 + 响应体业务码。
- 仅 HTTP 200 且业务码成功才算成功，否则按错误处理。

```python
# 正确：双层校验
async def call_llm_provider(prompt: str) -> dict:
    response = await httpx_client.post("/v1/generate", json={"prompt": prompt})
    if response.status_code != 200:
        raise LLMProviderError(f"HTTP {response.status_code}")
    body = response.json()
    if body.get("code") != 0:
        raise LLMProviderError(f"业务错误: {body.get('message')}")
    return body["data"]
```

### 8.3 Token 权限前置验证

- 调用第三方 API 前先验证本地 Token 权限是否足够，避免无效调用产生费用。
- Token 过期 / 权限不足时直接返回错误，不发起 API 调用。

### 8.4 外部 AI Provider（OD-05）

- 通用 LLM API（OpenAI / Claude）先行接入，须签 DPA 并确认数据不进训练集。
- 建筑专业 AI（EVAI / 小库 AI / 建筑学长）在 V1 维持 ManualHandoff，未获正式 API / 许可不得自动接入。
- 所有 AI 输出标记"AI 辅助"，按风险等级进入人工复核（见 `security.md` AI 安全红线）。
