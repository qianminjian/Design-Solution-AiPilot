# 测试环境分级指导手册（P0-1.1）

> 来源：SIT-IMPLEMENTATION-ROADMAP 板块一 P0-1.1
> 创建日期：2026-08-01
> 用途：定义 Dev/CI/Staging/Preprod 四级 TestEnvironment 配置，对齐 D44.5 六级环境

---

## 一、设计原则

### 1.1 D44.5 六级环境映射

D44 设计基线定义 6 级测试环境，本项目 V1 实现 4 级可执行环境（dev/ci/staging/preprod），production 由运维单独管理。

| D44.5 环境名称  | V1 实现 Profile | 数据来源                | 测试范围                                 | Compose 文件                 |
| --------------- | --------------- | ----------------------- | ---------------------------------------- | ---------------------------- |
| Local/Dev       | `local-dev`     | 合成/脱敏小样           | 单元、静态、安全扫描                     | `docker/compose.yml`         |
| Integration     | `integration`   | 版本化合成与连接器金样  | 契约/迁移/兼容测试                       | `docker/compose.ci.yml`      |
| Test            | （V2 演进）     | 固定 TestDataRelease    | 全链路、故障、性能冒烟                   | （V2）                       |
| Staging/Preprod | `staging`       | 匿名/合成规模数据       | D45 发布门禁、回滚演练                   | `docker/compose.staging.yml` |
| Staging/Preprod | `preprod`       | 生产等价合成数据        | D45 发布门禁、回滚演练、生产规模性能验证 | `docker/compose.preprod.yml` |
| Production      | `production`    | 授权生产数据            | Canary/健康/SLO/证据                     | （运维单独管理）             |
| DR              | （V2 演进）     | 加密复制的必要数据/配置 | 定期 Failover/Failback 演练              | （V2）                       |

### 1.2 核心设计原则（D44.5 + security.md）

1. **独立资源隔离**：每级环境使用独立账号/订阅、Cluster、KMS Root、数据库、Bucket、Topic、域名和身份信任域
2. **禁止生产数据复制**：禁止把生产数据复制到非生产环境，Preprod 需要生产规模时使用合成生成器和已批准脱敏快照
3. **镜像签名锁定**：Staging/Preprod 使用 image digest 锁定，禁止使用 `:latest` 标签
4. **LLM Mock 红线**：Dev/CI 环境强制 Mock LLM 调用（对齐 testing.md §4.2），Staging/Preprod 允许真实 LLM 调用
5. **调度任务启用**：Staging/Preprod 启用调度任务（A-64 Token 清理等），Dev/CI 禁用调度任务避免本地噪声
6. **资源递增**：内存资源随生产等价度递增（dev 384MB → ci 256MB → staging 768MB → preprod 1024MB）
7. **健康检查间隔**：CI 最短（3-5s 快速失败），生产等价环境适中（10-15s 平衡灵敏度与噪声）
8. **数据卷隔离**：每个 Profile 使用独立项目名（`platform-dev` / `platform-ci` / `platform-staging` / `platform-preprod`），确保数据卷不冲突

---

## 二、环境部署指南

### 2.1 Local/Dev 环境

**用途**：本地开发、单元测试、lint、typecheck

```bash
# 启动（默认使用基础 compose.yml）
docker compose -f docker/compose.yml -p platform-dev up -d

# 健康检查
docker compose -p platform-dev ps
curl -k https://localhost/health

# 停止释放资源
docker compose -p platform-dev stop
docker compose -p platform-dev down -v  # 完全清理（删除数据卷）
```

**配置特点**：

- 资源限制最小（核心服务 384MB）
- LOG_LEVEL=info
- LLM_API_KEY 可为空（Mock LLM）
- 调度任务禁用（避免本地噪声）
- 端口暴露（5432/9000/9001/8001/3001/3000）

### 2.2 CI/Integration 环境

**用途**：合并候选验证、契约测试、迁移测试、兼容测试

```bash
# 启动（CI 流水线使用 TEST_RUN_ID 注入唯一标识）
TEST_RUN_ID="ci-$(date +%s)-${GITHUB_RUN_ID:-local}" \
  docker compose -f docker/compose.yml -f docker/compose.ci.yml -p platform-ci up -d

# CI 流水线执行测试
docker compose -p platform-ci exec bff pnpm test
docker compose -p platform-ci exec core ./mvnw test
docker compose -p platform-ci exec ai pytest

# 测试完成后清理（删除所有数据，避免污染下次 CI 运行）
docker compose -p platform-ci down -v --rmi local
```

**配置特点**：

- 资源限制最小化（CI 并行多任务，单任务资源压缩）
- LOG_LEVEL=debug（CI 排查问题需要详细日志）
- LLM_API_KEY 强制为空（对齐 testing.md §4.2 LLM Mock 红线）
- TEST_RUN_ID 环境变量注入唯一标识（P0-1.2 数据隔离基础）
- 不暴露端口（仅通过 internal 网络访问）
- restart: "no"（CI 流水线一次性运行）

### 2.3 Staging 环境

**用途**：生产等价拓扑验证、D45 发布门禁、回滚演练

```bash
# 启动（必须注入敏感配置）
STAGING_DB_PASSWORD=xxx \
STAGING_S3_ACCESS_KEY=xxx \
STAGING_S3_SECRET_KEY=xxx \
STAGING_CHROMADB_AUTH_CREDENTIALS=xxx \
STAGING_LLM_API_KEY=xxx \
STAGING_CORS_ORIGIN=https://staging.example.com \
STAGING_NEXT_PUBLIC_BFF_URL=https://staging.example.com \
  docker compose -f docker/compose.yml -f docker/compose.staging.yml -p platform-staging up -d

# D45 验收测试套件
docker compose -p platform-staging exec core ./mvnw test -Pstaging
docker compose -p platform-staging exec bff pnpm test:e2e:staging

# 回滚演练（验证 RPO/RTO 达标）
docker compose -p platform-staging exec core ./scripts/rollback-rehearsal.sh

# 停止（保留数据卷供下次部署使用）
docker compose -p platform-staging stop
```

**配置特点**：

- 资源限制与生产等价（核心服务 768MB）
- LOG_LEVEL=info（生产等价日志级别）
- LLM_API_KEY 必填（受控真实依赖验证）
- AUDIT_LOG_DETAILED=true（D45 验收证据）
- SCHEDULER_ENABLED=true（验证调度任务）
- 通过 Nginx 反向代理提供 HTTPS 入口
- 仅暴露 80/443 端口（内部服务端口不暴露）

### 2.4 Preprod 环境

**用途**：生产规模验证、严格门禁、投产前最后一道防线

```bash
# 启动（必须注入敏感配置，与 Staging 类似但资源更大）
PREPROD_DB_PASSWORD=xxx \
PREPROD_S3_ACCESS_KEY=xxx \
PREPROD_S3_SECRET_KEY=xxx \
PREPROD_CHROMADB_AUTH_CREDENTIALS=xxx \
PREPROD_LLM_API_KEY=xxx \
PREPROD_CORS_ORIGIN=https://preprod.example.com \
PREPROD_NEXT_PUBLIC_BFF_URL=https://preprod.example.com \
  docker compose -f docker/compose.yml -f docker/compose.preprod.yml -p platform-preprod up -d

# 生产规模性能测试（k6/JMeter）
docker compose -p platform-preprod exec bff k6 run /tests/perf/production-scale.js

# D45 完整验收套件（功能+契约+性能+安全+可用性）
docker compose -p platform-preprod exec core ./mvnw verify -Ppreprod

# 部署后冒烟测试
docker compose -p platform-preprod exec bff pnpm test:smoke:preprod
```

**配置特点**：

- 资源限制与生产等价或更大（核心服务 1024MB）
- LOG_LEVEL=warn（接近生产日志级别）
- DB 连接池扩大（max=50, min=10）
- PostgreSQL 配置生产等价（shared_buffers=512MB）
- AUDIT_LOG_DETAILED=true（D45 验收证据）
- SCHEDULER_ENABLED=true（验证调度任务）
- Token 清理调度配置可调（环境变量）
- 健康检查间隔较长（15s，与生产等价）

---

## 三、配置差异矩阵

### 3.1 资源限制对比

| 服务         | Dev   | CI    | Staging | Preprod |
| ------------ | ----- | ----- | ------- | ------- |
| postgres     | 256m  | 192m  | 512m    | 1024m   |
| minio        | 256m  | 192m  | 512m    | 768m    |
| chromadb     | 512m  | 384m  | 768m    | 1024m   |
| core-service | 384m  | 256m  | 768m    | 1024m   |
| ai-service   | 256m  | 192m  | 512m    | 768m    |
| bff          | 128m  | 96m   | 192m    | 256m    |
| web          | 256m  | 192m  | 384m    | 512m    |
| nginx        | -     | -     | 64m     | 96m     |
| **总计**     | 2048m | 1612m | 3712m   | 5556m   |

### 3.2 环境变量对比

| 变量                   | Dev         | CI                | Staging    | Preprod    |
| ---------------------- | ----------- | ----------------- | ---------- | ---------- |
| SPRING_PROFILES_ACTIVE | docker      | ci                | staging    | preprod    |
| NODE_ENV               | development | test              | production | production |
| LOG_LEVEL              | info        | debug             | info       | warn       |
| LLM_API_KEY            | （空）      | （空，强制 Mock） | 必填       | 必填       |
| AUDIT_LOG_DETAILED     | -           | -                 | true       | true       |
| SCHEDULER_ENABLED      | false       | false             | true       | true       |
| TEST_RUN_ID            | -           | 必填              | -          | -          |

### 3.3 健康检查间隔对比

| 服务         | Dev | CI  | Staging | Preprod |
| ------------ | --- | --- | ------- | ------- |
| postgres     | 5s  | 3s  | 5s      | 10s     |
| minio        | 5s  | 3s  | 5s      | 10s     |
| chromadb     | 5s  | 5s  | 10s     | 15s     |
| core-service | 10s | 5s  | 10s     | 15s     |
| ai-service   | 10s | 5s  | 10s     | 15s     |
| bff          | 10s | 5s  | 10s     | 15s     |
| web          | 10s | 5s  | 10s     | 15s     |

### 3.4 端口暴露对比

| 端口                 | Dev | CI  | Staging | Preprod |
| -------------------- | --- | --- | ------- | ------- |
| 80 (HTTP)            | -   | -   | ✓       | ✓       |
| 443 (HTTPS)          | -   | -   | ✓       | ✓       |
| 3000 (web)           | ✓   | -   | -       | -       |
| 3001 (bff)           | ✓   | -   | -       | -       |
| 5432 (postgres)      | ✓   | -   | -       | -       |
| 8080 (core)          | ✓   | -   | -       | -       |
| 9000 (minio)         | ✓   | -   | -       | -       |
| 9001 (minio console) | ✓   | -   | -       | -       |
| 8001 (ai)            | ✓   | -   | -       | -       |

---

## 四、CI 流水线集成

### 4.1 GitHub Actions 集成示例

```yaml
# .github/workflows/ci-test.yml
name: CI Test (Integration Environment)

on:
  pull_request:
    branches: [main, develop]

jobs:
  integration-test:
    runs-on: ubuntu-latest
    env:
      TEST_RUN_ID: "ci-${{ github.run_id }}-${{ github.run_attempt }}"
    steps:
      - uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install pnpm
        run: npm install -g pnpm@9.15.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Integration Environment
        run: |
          docker compose \
            -f docker/compose.yml \
            -f docker/compose.ci.yml \
            -p platform-ci \
            up -d --build

      - name: Wait for services healthy
        run: |
          timeout 180 bash -c '
            while ! docker compose -p platform-ci ps | grep -c "healthy" | grep -q "8"; do
              sleep 5
              echo "Waiting for services healthy..."
            done
          '

      - name: Run shared unit tests
        run: pnpm --filter @design-platform/shared test

      - name: Run web typecheck
        run: pnpm --filter @design-platform/web typecheck

      - name: Run BFF typecheck
        run: pnpm --filter @design-platform/bff typecheck

      - name: Run Core Service tests
        run: docker compose -p platform-ci exec -T core ./mvnw test

      - name: Run AI Service tests
        run: docker compose -p platform-ci exec -T ai pytest

      - name: Cleanup
        if: always()
        run: |
          docker compose -p platform-ci down -v --rmi local
```

### 4.2 测试数据隔离（P0-1.2 预留）

CI 环境通过 `TEST_RUN_ID` 环境变量标记所有测试产生的数据：

- DB 行：`created_by` 字段携带 `test:ci-{run_id}` 前缀
- 对象存储文件：路径前缀 `test-runs/{run_id}/`
- 日志条目：`x-test-run-id` header 透传

CI 完成后 `docker compose down -v` 清理所有数据卷，确保下次 CI 运行从干净状态开始。

---

## 五、DeploymentProfile 共享契约

通过 `@design-platform/shared` 包暴露 DeploymentProfile 元数据，前端/BFF/后端共享：

```typescript
import {
  DeploymentProfile,
  DEPLOYMENT_PROFILE_METADATA,
  isProductionEquivalent,
  allowsRealLlmCall,
  getComposeOverrideArgs,
  getComposeProjectName,
} from "@design-platform/shared";

// 当前环境（由 process.env.DEPLOYMENT_PROFILE 注入）
const currentProfile =
  (process.env.DEPLOYMENT_PROFILE as DeploymentProfile) ??
  DeploymentProfile.LOCAL_DEV;

const meta = DEPLOYMENT_PROFILE_METADATA[currentProfile];

if (!meta.allowRealLlmCall && process.env.LLM_API_KEY) {
  console.warn(
    `Profile ${currentProfile} 禁止真实 LLM 调用，但 LLM_API_KEY 已设置，将忽略`,
  );
}

if (meta.schedulerEnabled) {
  // 启用调度任务（A-64 Token 清理等）
}
```

---

## 六、Support Matrix 差异记录

每级环境在 D44.2 Support Matrix 中记录版本差异：

| Profile     | Java   | Node   | PostgreSQL | ChromaDB   | LLM Provider      |
| ----------- | ------ | ------ | ---------- | ---------- | ----------------- |
| local-dev   | 21     | 20     | 16-alpine  | latest     | Mock              |
| integration | 21     | 20     | 16-alpine  | latest     | Mock              |
| staging     | 21     | 20     | 16-alpine  | latest     | OpenAI gpt-4o     |
| preprod     | 21     | 20     | 16-alpine  | latest     | OpenAI gpt-4o     |
| production  | 21 LTS | 20 LTS | 16         | 已验证版本 | 已签合同 Provider |

> **注**：CI/Staging/Preprod 使用相同基础镜像，仅配置不同；Production 必须使用受支持 LTS 版本与已签合同 Provider。

---

## 七、安全红线（security.md §1）

### 7.1 密钥管理

- 每级环境使用独立 KMS Root 托管密钥
- 生产环境密钥 90 天轮换一次（轮换期间新旧密钥并行 7 天）
- 禁止将 Staging/Preprod 密钥用于生产环境
- 禁止在 CI 日志中打印明文密钥（GitHub Actions 自动 mask `*_PASSWORD`、`*_SECRET_KEY`、`*_API_KEY` 变量）

### 7.2 数据隔离

- 每级环境使用独立数据库、Bucket、Topic
- 禁止跨环境复制数据（Dev → CI → Staging → Preprod 单向流动）
- Preprod 需要生产规模数据时使用合成生成器（V1.12+ 接入）
- 测试数据携带 `TEST_RUN_ID` 标记，便于审计与清理

### 7.3 网络隔离

- CI 环境不暴露公网端口（仅通过 internal 网络访问）
- Staging/Preprod 仅通过 Nginx HTTPS 入口暴露（443）
- 内部服务间通信通过 Docker 内部网络（不通过 host 网络）
- 跨环境通信通过 VPN/专线（V2 演进）

---

## 八、V0 差距记录

| 项                    | 当前状态      | V1.12+ 推进                           |
| --------------------- | ------------- | ------------------------------------- |
| Test 环境独立 Profile | V2 演进       | V2 单独配置                           |
| DR 环境               | V2 演进       | V2 与 Production DR 副本同步          |
| Production compose    | 由运维管理    | V1.12+ 提供生产部署模板               |
| Pact Broker 集成      | P0-1.3 待推进 | CI 环境新增 pact-broker 服务          |
| 测试数据隔离机制      | P0-1.2 待推进 | TEST_RUN_ID 标记 + 中间件注入 traceId |
| 测试报告存储          | P0-1.4 待推进 | MinIO + PostgreSQL TestEvidence 表    |

---

## 九、参考文档

- @design/D44-部署网络-环境拓扑.md §D44.5 测试环境分级
- @design/D44-部署网络-环境拓扑.md §D44.6 Region→Cell 总体拓扑
- @design/D45-测试-验收体系.md 测试与验收体系
- @design/D02-版本路线-场景优先级.md 版本路线与场景优先级
- `.trae/rules/remote-verification.md` 远程验证环境执行规则
- `.trae/rules/security.md` 安全与隐私核心规则
- `.trae/rules/testing.md` 多语言测试统一规范
- `packages/shared/src/contracts/deployment.contract.ts` DeploymentProfile 契约
- `docs/SIT-IMPLEMENTATION-ROADMAP.md` SIT 实施路线图
- `docs/SIT-TASK-TRACKER.md` SIT 任务跟踪列表
