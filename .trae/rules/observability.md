---
alwaysApply: false
globs: services/**, apps/bff/**
---

> 来源：PrismScan L2-project 规则适配

# 可观测性规范（含错误监控）

适用范围：核心业务服务（services/core Java）、AI 服务（services/ai Python）、BFF（apps/bff NestJS）。
本规范为强制约定，所有新增/修改服务代码须满足下列要求，PR 评审时逐项检查。

## 一、结构化日志（所有服务强制）

### 1.1 格式要求

- 日志输出统一为 **JSON 格式**，字段名使用 **snake_case**。
- `message` 字段为人类可读的简明描述，避免把变量直接拼进 message，应放入结构化字段。
- 禁止使用 `console.log` / `System.out.println` / `print` 输出纯字符串日志（调试用途见 DevEx 规范的 `debug` 库）。

### 1.2 必含字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `timestamp` | string | ISO8601 含毫秒，如 `2026-07-22T10:15:30.123Z` |
| `level` | string | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `service` | string | 服务名，如 `core` / `ai` / `bff` / `web` |
| `version` | string | 服务版本（GIT_SHA） |
| `trace_id` | string | 分布式追踪 ID（OpenTelemetry） |
| `span_id` | string | 当前 Span ID |
| `user_id` | string | 用户 ID（匿名/未登录时为 `anonymous`） |

### 1.3 各语言工具选型

| 服务 | 语言 | 工具 | 配置要点 |
|------|------|------|----------|
| BFF | TypeScript (NestJS 11) | Pino (`nestjs-pino`) | `pino-pretty` 仅开发环境，生产用 JSON transport |
| 核心 | Java 21 (Spring Boot 3.4) | Logback + JSON encoder (`logstash-logback-encoder`) | `logging.pattern.level` 关闭，使用 JSON encoder |
| AI | Python 3.12 (FastAPI) | structlog | `structlog.processors.JSONRenderer()`，生产关闭 `ConsoleRenderer` |

### 1.4 生产日志级别

- 生产环境固定 **INFO**，禁止 DEBUG 日志进入生产。
- 如需临时排查，通过动态日志级别（Spring Boot Actuator / structlog `configure`）临时调整，事后恢复。
- DEBUG 日志须有 `trace_id` 关联，便于事后过滤。

## 二、日志脱敏（强制）

### 2.1 必须脱敏的字段

以下信息在进入日志前必须脱敏（掩码或哈希），不得明文输出：

- 设计文件路径（客户图纸路径，须替换为 `design_file_id` 引用）
- 客户信息（公司名、项目名敏感部分）
- 审批签名（电子签名值、签名人证书指纹）
- 手机号（保留前 3 后 4，如 `138****1234`）
- 身份证号（保留前 6 后 4，中间用 `*`）
- 邮箱地址（保留首字符与域名，如 `z***@example.com`）

### 2.2 禁止进入日志的内容

- 原始密码、密码哈希
- Bearer Token / API Key / Refresh Token
- AI Provider 的完整请求体（可能含客户设计数据）
- 数据库连接字符串中的明文密码
- 文件上传的完整二进制内容

### 2.3 实现方式

- NestJS：Pino 自定义 `redact` 配置，路径列出敏感字段。
- Java：Logback 自定义 `LogMaskingConverter`，正则匹配手机号/身份证。
- Python：structlog 自定义 processor，在 JSONRenderer 前执行脱敏。

## 三、指标（Metrics）

### 3.1 RED 指标（每个 API 端点强制）

| 指标 | 含义 | 维度 |
|------|------|------|
| Rate | 请求速率（req/s） | `endpoint`, `method` |
| Error rate | 错误率（5xx 占比） | `endpoint`, `method`, `status_class` |
| Duration | 响应延迟 P50 / P95 / P99 | `endpoint`, `method` |

### 3.2 USE 指标（资源层强制）

| 资源 | Utilization | Saturation | Errors |
|------|------------|-----------|--------|
| CPU | 使用率 % | 运行队列长度 | — |
| 内存 | 使用率 % | 可用内存阈值 | OOM 次数 |
| 磁盘 | 使用率 % | I/O wait | 读写错误次数 |
| 网络 | 带宽使用率 | 重传率 | 丢包率 |

### 3.3 禁止项（基数爆炸防护）

- **禁止**将 `user_id` / `session_id` / `request_id` / `trace_id` 作为 Metrics label。
- 高基数字段只能进日志/追踪，不能进 Metrics label。
- Label 组合数须控制，单指标 label 基数上限 < 100。

### 3.4 工具选型

- 采集：OpenTelemetry SDK + Prometheus exporter。
- BFF/核心/AI 服务均暴露 `/metrics` 端点（Prometheus 格式）。
- 聚合：Prometheus，可视化 Grafana。

## 四、分布式追踪（Distributed Tracing）

### 4.1 协议与传播

- 采用 **OpenTelemetry** + **W3C TraceContext**（`traceparent` header）。
- 跨服务调用（BFF → Core / BFF → AI / Core → AI）须透传 `traceparent`。
- 入口服务（BFF）生成 `trace_id`，下游服务从 header 提取并续接。

### 4.2 关键 Span 埋点（必须）

以下操作必须创建独立 Span 并标注属性：

| 操作 | Span 名称 | 关键属性 |
|------|----------|----------|
| PostgreSQL 查询 | `db.query` | `db.system`, `db.statement`(脱敏), `db.rows_returned` |
| HTTP 出站调用 | `http.client` | `http.method`, `http.url`, `http.status_code` |
| AI Provider 调用 | `ai.provider.call` | `ai.provider`, `ai.model`, `ai.tokens_total`, `ai.latency_ms` |
| MinIO/S3 读写 | `s3.{operation}` | `s3.bucket`, `s3.key`(脱敏), `s3.bytes` |

### 4.3 Trace ID 回传前端

- BFF 在响应头回传 `x-trace-id`，前端可在错误上报时携带，串联前后端链路。
- 前端错误监控（Sentry）的 tag 中携带 `trace_id`。

### 4.4 采样策略

- **头采样**：入口 10% 采样，保证基线可观测。
- **尾采样**：保留所有 ERROR 级别 + P99 延迟的 Trace（避免长尾问题丢失）。
- 生产 `tracesSampleRate` = 0.1（10%），见下文 Sentry 配置。

## 五、SLO（服务等级目标）

| 服务等级 | 适用对象 | SLO | 衡量窗口 |
|----------|----------|-----|----------|
| 核心设计 API | 施工图审查、版本流转 | ≥ 99.95% | 30 天滚动 |
| 查询 API | 项目列表、规范查询 | ≥ 99.0% | 30 天滚动 |
| 后台 Web | 工作台前端 | ≥ 99.5% | 30 天滚动 |

- SLO 计算基于可用性 = 成功请求数 / 总请求数（排除 4xx 客户端错误）。
- SLO 预算消耗 > 80% 时触发预警，进入 BEACON.md 决策日志。

## 六、告警规范

### 6.1 多窗口燃尽率告警

- **禁止**单窗口抖动告警（如"1 分钟内错误率 > 5%"直接告警），避免误报。
- 采用多窗口燃尽率（multi-window multi-burn-rate）：短窗口（5m）与长窗口（1h）同时超阈值才告警。
- 示例：5m 错误率 > 2% **且** 1h 错误率 > 1% → 触发 P1 告警。

### 6.2 告警通道与时效

| 等级 | 响应时效 | 通道 | 触发条件示例 |
|------|----------|------|-------------|
| P0 | 5 分钟 | 电话 + 短信 + 飞书 | 核心设计服务不可用（5xx 持续 > 1 分钟） |
| P1 | 15 分钟 | 飞书 + 邮件 | BFF 错误率 > 1%（多窗口） |
| P2 | 1 小时 | 飞书 | 非核心功能异常（如规范查询延迟 P99 > 3s） |

### 6.3 告警内容要求（可操作性）

每条告警必须包含以下可操作信息，禁止"服务异常"这类无信息告警：

- 服务名（`service`）
- 端点 / 资源（`endpoint` / `resource`）
- 当前指标值与阈值
- `trace_id` 链接（跳转 Grafana / Jaeger / Sentry）
- runbook 链接（指向事故响应文档）

## 七、错误监控（Sentry 集成，所有服务必接）

### 7.1 各服务 SDK 选型

| 服务 | SDK | 初始化要点 |
|------|-----|-----------|
| Web (Next.js 15) | `@sentry/nextjs` | `sentry.client.config.ts` + `sentry.server.config.ts` + `next.config.js` wrapper |
| BFF (NestJS 11) | `@sentry/node` | 在 `main.ts` 初始化，注册 `Sentry.Integrations`，Express 中间件前置 |
| Core (Java 21) | `sentry-spring-boot-starter` | `application.yml` 配置 `sentry.dsn`，注册 `SentryExceptionResolver` |
| AI (Python 3.12) | `sentry-sdk[fastapi]` | `sentry_sdk.init()` 在 FastAPI 启动前调用，集成 `FastApiIntegration` |

### 7.2 通用配置项

所有服务 Sentry 初始化须包含：

```yaml
dsn: $SENTRY_DSN
environment: $SENTRY_ENV            # production / staging / development
release: $GIT_SHA                   # 与服务版本一致，便于版本关联
tracesSampleRate: 0.1               # 生产 10%，开发可设 1.0
```

- `release` 必须使用 `GIT_SHA`，禁止硬编码版本号。
- 禁止 dev 环境配置生产 DSN（开发环境用独立 DSN 或 `SENTRY_DSN=""` 禁用上报）。

### 7.3 Sentry 脱敏（强制）

#### beforeSend 钩子

所有服务须配置 `beforeSend`，删除以下敏感字段后再上报：

- `password` / `token` / `secret` / `api_key`
- 设计文件签名值（`signature_value`）
- 审批意见中的客户信息（`approval_comment` 原文须脱敏后保留摘要）

示例（NestJS）：

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      delete data.password;
      delete data.token;
      delete data.signature_value;
    }
    return event;
  },
});
```

#### Session Replay 脱敏

- `maskAllText: true`（遮蔽所有文本）
- `maskAllInputs: true`（遮蔽所有输入框）
- `blockAllMedia: true`（阻止媒体采集，避免设计图纸截图上传）

#### 用户上下文

- 使用 `Sentry.setUser({ id, role })`，**禁止**放入 `email` / `phone`。
- `id` 使用系统内部用户 ID，`role` 为角色枚举（`architect` / `reviewer` / `admin`）。

## 八、错误分类与处理策略

### 8.1 错误分类表

| 错误类型 | 示例 | 处理策略 |
|----------|------|----------|
| BusinessError | "规范条文未找到"、"项目无访问权限" | `beforeSend` 过滤，**不告警**，仅记日志 |
| 系统错误 | DB 连接断开、AI Provider 超时、OOM | **必须上报** Sentry，按等级触发告警 |
| AI 调用失败 | LLM 返回异常、生成内容不合规 | 上报 Sentry + **按风险等级进入人工复核流程**（见设计约束红线） |

### 8.2 BusinessError 过滤实现

- NestJS：自定义异常过滤器，`Sentry.withScope` 内标记 `level: 'info'` 后 `return null` 过滤。
- Java：`@ControllerAdvice` 中识别 `BusinessException`，调用 `Sentry.captureException` 前判断是否上报。
- Python：FastAPI 异常处理中间件，`BusinessError` 仅记日志不上报。

### 8.3 AI 调用失败的人工复核

- AI 服务返回失败时，须在响应中标记 `needs_review: true` 并附带 `risk_level`。
- 失败详情写入 `ai_call_audit` 表，关联 `trace_id` 供人工复核追溯。
- 复核流程见设计文档 D35（错误码体系）与设计约束红线。

## 九、告警分级表

| 等级 | 响应时效 | 通知通道 | 触发条件 | 示例场景 |
|------|----------|----------|----------|----------|
| P0 | 5 分钟 | 电话 + 短信 | 核心设计服务不可用 | 施工图审查服务全部 5xx |
| P1 | 15 分钟 | 飞书 | BFF 错误率 > 1% | 网关层错误率异常（多窗口） |
| P2 | 1 小时 | 飞书 | 非核心功能异常 | 规范查询 P99 > 3s |

## 十、SLA 表格

| 影响范围 | 响应时间 | 修复时间 |
|----------|----------|----------|
| 影响所有用户 | < 15 分钟 | < 2 小时 |
| 影响 > 10% 用户 | < 30 分钟 | < 24 小时 |
| 影响 < 10% 用户 | < 2 小时 | < 3 个工作日 |
| 单用户问题 | < 1 个工作日 | < 5 个工作日 |

- 修复后 48 小时内完成复盘（5 Whys 根因分析），改进措施带 owner 与完成日期，记录至 BEACON.md。
- 无指责文化：复盘聚焦流程与系统改进，不追责个人。

## 十一、禁止项

- 禁止 `console.log` / `print` / `System.out.println` 进入生产代码。
- 禁止原始密码、Token、设计文件签名进入日志或 Sentry。
- 禁止 `user_id` / `session_id` 作为 Metrics label。
- 禁止单窗口抖动告警（须用多窗口燃尽率）。
- 禁止 dev 环境配置生产 Sentry DSN。
- 禁止 Sentry Session Replay 采集设计图纸内容（`blockAllMedia` 必开）。
- 禁止 BusinessError 触发 P0/P1 告警。
- 禁止 AI 调用失败跳过人工复核流程直接返回用户。
