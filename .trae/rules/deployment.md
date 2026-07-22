---
alwaysApply: false
globs: docker/**, .github/**, services/**
---

> 来源：PrismScan L2-project 规则适配

# 部署与发布规范（Hybrid-Site 适配）

适用范围：Docker 镜像构建（docker/）、CI/CD 流水线（.github/）、核心业务服务与 AI 服务（services/）。
本项目采用 Hybrid-Site 部署画像（OD-06 决策）：云控制面 + 客户站点 Windows Worker，RPO≤4h / RTO≤8h。

## 一、灰度发布（云控制面服务）

### 1.1 金丝雀阶段

云控制面服务（BFF / Core / AI）发布须按以下阶段灰度推进，每阶段监控 10 分钟：

| 阶段 | 流量比例 | 监控重点 | 通过条件 |
|------|----------|----------|----------|
| 第 1 阶段 | 5% | 错误率、P99 延迟、SLO 预算 | 10 分钟内无异常 |
| 第 2 阶段 | 20% | 同上 + 资源使用率 | 10 分钟内无异常 |
| 第 3 阶段 | 50% | 同上 + 下游服务影响 | 10 分钟内无异常 |
| 第 4 阶段 | 100% | 全量观测 | 稳定 30 分钟后标记发布完成 |

### 1.2 自动熔断与回滚

任一阶段触发以下条件时，**自动熔断并回滚**到上一稳定版本：

| 熔断条件 | 阈值 |
|----------|------|
| 错误率 | > 1% |
| P99 延迟 | > 5s |
| 5xx 错误率 | > 0.5% |

- 熔断由发布系统自动执行，无需人工干预；熔断事件须记入 BEACON.md 决策日志。
- 熔断后须在 1 小时内完成根因初判，决定是否修复后重新发布。

### 1.3 服务级熔断器

调用外部 AI Provider 时**必须配置**熔断器（Resilience4j / opossum），防止级联故障：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 超时（timeout） | 3s | 单次 AI 调用超时阈值 |
| 错误率阈值（failureRateThreshold） | 50% | 触发熔断的错误率 |
| 恢复时间（resetTimeout / waitDuration） | 30s | 熔断后试探恢复的等待时间 |

- Java 服务使用 Resilience4j `@CircuitBreaker`。
- Python 服务使用 `opossum` 或 `circuitbreaker` 库。
- 熔断器状态变化须记日志并上报指标（`circuit_breaker.state`）。

## 二、回滚规范

### 2.1 回滚时效

- 云控制面服务回滚时间 **≤ 5 分钟**（镜像切换 + 健康检查通过）。
- 客户站点 Windows Worker 回滚须考虑离线/弱网，最长不超过 RTO（8h）。

### 2.2 数据库迁移兼容性

- **所有 Flyway 迁移必须有 down 脚本**（使用 Flyway Undo 或手动回滚 SQL 文档化）。
- 回滚前须验证 down 脚本可在当前数据状态下安全执行（双向兼容）。
- 禁止无 down 的 Flyway 迁移进入生产（见禁止项）。

### 2.3 回滚命令文档化（runbook）

每个服务须在 `docs/runbook/` 维护回滚 runbook，包含：

- 回滚触发条件（对应熔断条件 + 人工判断场景）
- 回滚命令（镜像版本切换、数据库 down 脚本执行顺序）
- 回滚验证步骤（健康检查、关键 API 冒烟测试）
- 回滚后数据一致性检查（客户站点 Worker 状态同步）

## 三、Hybrid-Site 特殊约束

### 3.1 客户站点 Windows Worker

客户站点 Worker 部署在客户内网 Windows 环境，与云控制面通过受限网络通信，须遵守：

| 约束 | 要求 |
|------|------|
| 离线/弱网 | Worker 须支持断网降级运行，本地缓存待同步任务 |
| RPO | ≤ 4h（数据回溯点目标，即最多丢失 4 小时增量） |
| RTO | ≤ 8h（恢复时间目标，即故障后 8 小时内恢复服务） |
| 数据同步 | Worker 与云控制面通过 Outbox + 增量拉取同步，弱网时自动重试 |

### 3.2 数据库迁移双向兼容

- DB 迁移必须**双向兼容**：升级与回滚均能安全执行。
- down 脚本须在 staging 环境验证（含客户站点模拟数据），验证通过方可进入生产。
- 涉及 schema 破坏性变更（删列/改类型）时，须采用多阶段迁移（先兼容期 → 再清理），禁止一步到位。

### 3.3 Worker 镜像管理

- 客户站点 Worker 镜像通过 **WorkerImageProfile** 管理，参考 `design/r2-deployment-profile/`。
- 镜像版本与云控制面版本关联记录，支持按客户站点灰度推送（部分客户先行）。
- 弱网环境下支持镜像增量分发（layer cache + 断点续传）。

## 四、Docker 镜像规范

### 4.1 多阶段构建

所有服务 Dockerfile 须采用**多阶段构建**（构建层 + 运行层分离）：

```dockerfile
# 构建层（含构建工具与源码）
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 运行层（仅含运行时依赖与产物）
FROM node:22-slim AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/main.js"]
```

### 4.2 基础镜像选型

| 服务 | 基础镜像 | 说明 |
|------|----------|------|
| Java (Core) | `eclipse-temurin:21-jre` | JRE 运行时，不含 JDK |
| Python (AI) | `python:3.12-slim` | 精简版，按需安装系统依赖 |
| TypeScript (BFF/Web) | `node:22-slim` | Node 22 LTS 精简版 |

- 禁止使用 `latest` tag，须锁定具体版本。
- 定期扫描基础镜像 CVE 漏洞，高危漏洞 7 天内升级。

### 4.3 非 root 用户运行

- 所有容器以**非 root 用户**运行：
  - Node：使用 `node` 用户（基础镜像内置）。
  - Java：创建 `appuser` 用户并切换。
  - Python：创建 `appuser` 用户并切换。
- 禁止容器以 root 运行（安全红线）。

### 4.4 .dockerignore

`.dockerignore` 须排除以下内容，避免敏感信息与大文件进入镜像：

```
node_modules
.git
tests
__pycache__
*.pyc
.env
.env.local
coverage
dist
build
Dockerfile
docker-compose*.yml
```

## 五、环境变量注入（12-factor 原则）

### 5.1 配置外部化

- 所有配置通过**环境变量**注入，禁止硬编码在代码中。
- 启动时**验证关键配置存在**，缺失则拒绝启动并输出明确错误：

```typescript
// NestJS 示例
const requiredEnv = ['DB_HOST', 'DB_PASSWORD', 'S3_ENDPOINT', 'SENTRY_DSN'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`缺少必需环境变量: ${key}`);
  }
}
```

### 5.2 环境分层

| 环境 | 用途 | 数据 |
|------|------|------|
| development | 本地开发 | 本地 MinIO + 本地 PG |
| staging | 预发布验证 | 模拟生产数据 |
| production | 生产 | 真实客户数据 |

- 禁止生产配置进入代码仓库（使用密钥管理服务注入）。

## 六、健康检查

### 6.1 探针配置

- **liveness 探针**：判断容器是否需要重启。
- **readiness 探针**：判断容器是否可接收流量。
- 两者均指向 `/health` 端点，但检查内容不同（liveness 检查进程存活，readiness 检查依赖就绪）。

### 6.2 /health 端点规范

`/health` 端点返回 JSON，包含状态、版本与各项检查：

```json
{
  "status": "up",
  "version": "v1.2.3 (abc1234)",
  "checks": {
    "database": "up",
    "s3": "up",
    "ai_provider": "degraded"
  }
}
```

- `status` 为 `up` / `degraded` / `down`。
- 任一关键 check 为 `down` 时，readiness 探针返回 503，流量摘除。
- AI Provider 为 `degraded` 时仍可服务（降级策略），但不影响 liveness。

## 七、事故响应

### 7.1 响应时效

| 等级 | 响应时效 | 说明 |
|------|----------|------|
| P0 | 15 分钟内响应 | 核心设计服务不可用 |
| P1 | 30 分钟内响应 | 部分功能不可用 |
| P2 | 2 小时内响应 | 非核心异常 |
| P3 | 1 个工作日内响应 | 用户体验问题 |

### 7.2 复盘机制

- P0/P1 事故须在 **48 小时内**完成复盘。
- 复盘采用 **5 Whys** 根因分析方法，输出：
  - 时间线（发现 → 响应 → 恢复 → 验证）
  - 根因（技术根因 + 流程根因）
  - 改进措施（带 owner 与完成日期）
- 复盘记录至 BEACON.md 决策日志，改进措施纳入迭代跟踪。

### 7.3 无指责文化

- 复盘聚焦**流程与系统改进**，不追责个人。
- 鼓励主动上报问题，隐瞒事故比事故本身更严重。

## 八、故障等级表

| 等级 | 定义 | 影响 | 响应 | 修复 |
|------|------|------|------|------|
| P0 | 核心服务不可用 | 施工图审查/版本流转全部中断 | 15 分钟 | 2 小时 |
| P1 | 部分功能不可用 | 单一专业或单一客户受影响 | 30 分钟 | 24 小时 |
| P2 | 非核心异常 | 辅助功能异常，有绕过方案 | 2 小时 | 3 工作日 |
| P3 | 用户体验问题 | 性能/交互体验问题 | 1 工作日 | 5 工作日 |

## 九、禁止项

- **禁止**手动 apply 到生产环境（须通过 CI/CD 流水线）。
- **禁止**跳过 CI 检查 merge PR（含 lint / test / typecheck）。
- **禁止**生产环境使用 debug 镜像（含 JDK / devDependencies / 调试工具）。
- **禁止**无 down 脚本的 Flyway 迁移进入生产。
- **禁止**灰度期间不做监控直接全量发布（必须每阶段监控 10 分钟）。
- **禁止**容器以 root 用户运行。
- **禁止**基础镜像使用 `latest` tag。
- **禁止**生产配置硬编码进代码仓库。
- **禁止**回滚时不验证数据库 down 脚本兼容性。
- **禁止**客户站点 Worker 跳过 WorkerImageProfile 管理直接分发镜像。
