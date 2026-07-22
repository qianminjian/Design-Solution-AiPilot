---
alwaysApply: false
description: 编辑 apps/bff/ 下的 NestJS BFF 代码时使用该规则
globs: apps/bff/**
---

# BFF 开发规则（NestJS 11 + TypeScript）

## 框架约束

- NestJS 11，使用模块化组织（`@Module` / `@Controller` / `@Injectable`）。
- BFF 是 API 聚合层，不承载业务逻辑——业务逻辑在 `services/core/`（Java）。
- BFF 负责：请求转发、响应裁剪、认证鉴权、限流。
- 依赖注入使用 NestJS DI 容器，不手动 `new` 服务实例。

## 目录结构

```
apps/bff/src/
├── app.module.ts      # 根模块
├── main.ts            # 入口
├── health/            # 健康检查
├── modules/           # 功能模块（按领域分）
│   ├── auth/          # 认证
│   ├── project/       # 项目
│   └── design/        # 设计
├── common/            # 拦截器、过滤器、管道、守卫
└── config/            # 配置
```

## API 契约

- REST API 路径与 `design/r2-contract-catalog/` 中分配的稳定 ID 一致。
- 错误响应遵循统一格式（`errorCode` + `message` + `traceId`）。
- 使用 class-validator 进行 DTO 校验。
- 版本化：URL 中不暴露版本号，通过 Header `Accept-Version` 控制。

## 调用下游服务

- 调用 `services/core/`（Java）使用 HTTP（`HttpService` from `@nestjs/axios`）。
- 调用 `services/ai/`（Python）使用 HTTP。
- 所有外部调用设置超时（默认 5s）和重试（3 次，指数退避）。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | BFF 监听端口 |
| `CORE_SERVICE_URL` | http://localhost:8080 | 核心服务地址 |
| `AI_SERVICE_URL` | http://localhost:8000 | AI 服务地址 |

## 测试

- 单元测试使用 Jest（NestJS 内置）。
- E2E 测试使用 `@nestjs/testing` 的 `Test.createTestingModule`。

## 认证授权规范

### JWT 规范

- Access Token ≤ 15min
- Refresh Token ≤ 7d + Refresh Rotation（每次刷新返回新 RT，旧失效）
- RS256（非对称）或 HS256（对称）签名，密钥从环境变量读取
- JWT Payload：sub / iss / aud / iat / exp / jti / role
- 禁止在 JWT 存敏感信息（可解码，仅防篡改）
- 禁止 Refresh Token 存 localStorage（用 httpOnly cookie）

### 授权模型（RBAC + 项目维度）

- 角色枚举：PRINCIPAL_ARCHITECT / ARCHITECT / REVIEWER / PROJECT_MANAGER / CLIENT / ADMIN
- 权限枚举：DESIGN_READ / DESIGN_WRITE / DESIGN_SUBMIT / DESIGN_APPROVE（注册建筑师专属）/ AI_GENERATE / PROJECT_MANAGE
- RBAC + 项目维度（projectId）双重校验
- 禁止只在前端隐藏权限（后端必须再查）
- 关键操作（专业审签）记录审计日志

### MFA（推荐）

- TOTP（Google Authenticator）所有用户
- WebAuthn / Passkey 优先推荐（防钓鱼）
- SMS 不推荐（SIM Swap 风险）

### 密码策略

| 规则 | 值 |
|------|-----|
| 最小长度 | 8 字符 |
| 复杂度 | 大小写 + 数字 + 特殊字符（至少 3 类） |
| 存储 | bcrypt（cost ≥ 12）或 argon2id |
| 密码历史 | 禁止最近 5 次 |
| 失败锁定 | 5 次失败锁定 15 分钟 |

## 限流与熔断规范

### 限流算法选型

| 算法 | 适用场景 |
|------|---------|
| 令牌桶 | 允许突发流量（通用 API） |
| 滑动窗口 | 严格平滑限流（写操作 / 计费） |
| 漏桶 | 恒定速率（出站请求） |

### 分层限流

- 单 IP：100 req/s
- 单用户：50 req/s
- 登录接口：5 req/min（防暴力破解）
- 设计文件上传：10 req/s
- AI 生成请求：按 LLM 供应商限制

### 429 响应规范

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718706660
```

- 必须返回 Retry-After header
- 禁止只限 IP 不限用户（共享 IP 误伤，设计院共用 IP）

### 熔断器（Circuit Breaker）

状态机：CLOSED → OPEN → HALF_OPEN

| 场景 | 失败阈值 | 冷却时间 |
|------|---------|---------|
| LLM API 调用 | 5 次失败 / 60s | 30s |
| 数据库连接 | 3 次失败 / 30s | 15s |
| Core ↔ AI 服务调用 | 10 次失败 / 120s | 60s |
| 校审提交（核心写） | 1 次失败即熔断 | 手动恢复 |

### 降级策略

| 级别 | 策略 | 示例 |
|------|------|------|
| L1 缓存降级 | 用过期缓存 | 设计文件列表暂显缓存 |
| L2 功能降级 | 关闭非核心 | AI 推荐降级为最近使用 |
| L3 读降级 | 只读不写 | 查询正常但创建暂停 |
| L4 全局限流 | 白名单 | 仅管理员可操作 |
