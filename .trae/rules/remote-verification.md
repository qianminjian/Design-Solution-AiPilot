---
alwaysApply: true
description: 远程验证环境执行规则——所有验证类专题统一在远程服务器实施，不在本地起容器
---

# 远程验证环境执行规则

> 来源：2026-08-01 用户决策——远程环境已部署，资源充足，所有验证专题统一在远程实施

## 一、核心原则

### 1.1 远程优先，禁止本地起容器

- **所有验证类专题（功能验证、集成验证、E2E 验证、性能验证、契约验证、安全验证、Chaos 验证、UAT 等）统一在远程服务器实施。**
- **禁止在本机起 docker compose 容器进行验证**（避免本机 16GB 内存压力，释放本地资源用于开发与代码编辑）。
- 本地仅用于：代码编辑、单元测试（无外部依赖）、lint、typecheck、git 操作。
- 集成测试、E2E 测试、需要真实数据库/对象存储/AI Provider 的测试，一律在远程服务器执行。

### 1.2 远程资源充足，不限制内存

- 远程服务器资源充足，**不需要对子 agent 并发数施加严格限制**（但仍需避免无意义的并行，保持任务有序）。
- 远程执行任务时，不需要检查内存阈值，不需要熔断机制。
- 远程环境支持大规模并发测试、负载测试、压力测试、长稳测试。

### 1.3 远程环境访问方式

- 通过 SSH 访问远程服务器（具体连接信息见 `docs/SYSTEM-TEST-GUIDE.md` 环境准备章节）。
- 远程服务通过 Docker Compose 编排，包含 7 个服务：postgres、minio、chromadb、core、ai、bff、web。
- 远程环境通过 Nginx 反向代理提供 HTTPS 访问入口。
- 所有部署、验证、测试操作通过 SSH + 远程命令执行。

## 二、任务分类与执行位置

| 任务类型                  | 执行位置 | 说明                                                |
| ------------------------- | -------- | --------------------------------------------------- |
| 代码编辑                  | 本地     | IDE 编辑、代码修改                                  |
| 单元测试（无外部依赖）    | 本地     | `pnpm test`、`mvn test`、`pytest`（无 DB/外部 API） |
| Lint / Typecheck          | 本地     | `pnpm lint`、`pnpm typecheck`                       |
| Git 操作                  | 本地     | 提交、推送、分支管理                                |
| 集成测试                  | **远程** | 需要真实 DB/对象存储/MQ                             |
| E2E 测试                  | **远程** | Playwright 脚本在远程环境执行                       |
| 契约测试（Provider 验证） | **远程** | 需要真实服务端点                                    |
| 性能 / 压力 / 长稳测试    | **远程** | k6 / JMeter / Locust 在远程执行                     |
| 安全测试（DAST / 渗透）   | **远程** | OWASP ZAP / Nuclei / Burp                           |
| Chaos 测试                | **远程** | Chaos Mesh / Toxiproxy                              |
| AI TEVV 评测              | **远程** | 批量离线评测                                        |
| 远程环境部署验证          | **远程** | 部署后冒烟测试                                      |

## 三、远程验证执行流程

### 3.1 部署阶段

```bash
# 1. SSH 登录远程服务器
ssh user@remote-host

# 2. 拉取最新代码
cd /path/to/project && git pull

# 3. 启动远程服务
docker compose -f docker/compose.yml up -d --build

# 4. 验证服务健康
docker compose ps
curl -k https://localhost/health
```

### 3.2 验证阶段

```bash
# 1. 执行远程测试套件
docker compose exec bff pnpm test
docker compose exec core ./mvnw test
docker compose exec ai pytest

# 2. 执行 E2E 测试
docker compose exec web pnpm e2e

# 3. 执行性能测试
docker compose exec bff k6 run /tests/perf/baseline.js

# 4. 查看测试报告
# 报告输出到 MinIO 或 PostgreSQL，通过 Web 界面查看
```

### 3.3 清理阶段

```bash
# 1. 测试完成后可停止服务释放资源
docker compose stop

# 2. 完全清理（删除数据卷）
docker compose down -v
```

## 四、远程验证环境配置

### 4.1 服务清单

| 服务     | 端口             | 用途                 |
| -------- | ---------------- | -------------------- |
| Nginx    | 443 (HTTPS)      | 反向代理入口         |
| web      | 3000 (内部)      | Next.js 前端         |
| bff      | 3001 (内部)      | NestJS BFF           |
| core     | 8080 (内部)      | Spring Boot 核心服务 |
| ai       | 8000 (内部)      | FastAPI AI 服务      |
| postgres | 5432 (内部)      | PostgreSQL 16        |
| minio    | 9000/9001 (内部) | MinIO 对象存储       |
| chromadb | 8001 (内部)      | ChromaDB 向量数据库  |

### 4.2 关键配置项

- 远程访问域名：通过 Nginx HTTPS 反向代理
- 数据持久化：postgres、minio 数据卷持久化
- 日志聚合：docker compose logs 或 ELK 栈
- 监控：Prometheus + Grafana（可选）

## 五、Agent 并发执行策略调整

### 5.1 远程任务并发

- 远程资源充足，**允许并行启动多个子 agent 执行远程验证任务**。
- 建议并行数：3-5 个子 agent（视任务复杂度调整）。
- 不需要内存熔断机制。
- 不需要检查 vm_stat 或可用内存。

### 5.2 本地任务并发（仅限开发阶段）

- 本地仅做代码编辑与轻量测试，内存压力低。
- 若本地并行启动多个子 agent 加载源码，仍需注意内存占用（保留原有限制的宽松版）。
- 本地并行建议不超过 3 个子 agent。

### 5.3 混合模式推荐

```
本地：代码编辑 → 提交推送 → 远程验证
                                    ↓
本地：接收结果 ← 远程：执行测试 ← 远程：拉取代码
```

- 开发在本地，验证在远程。
- 远程验证结果通过日志、报告、截图等方式回传本地分析。

## 六、文档与任务跟踪对齐

### 6.1 SIT 任务跟踪

- `docs/SIT-TASK-TRACKER.md` 中所有任务默认在远程执行。
- 任务完成时，在"完成日期"列填入远程验证通过的日期。
- 备注列可记录远程验证的关键日志或报告链接。

### 6.2 系统测试指导手册

- `docs/SYSTEM-TEST-GUIDE.md` 中的测试步骤默认在远程环境执行。
- 所有"启动服务"步骤改为"确认远程服务已启动"。
- 测试命令通过 SSH 或 docker compose exec 执行。

## 七、与原内存管控规则的关系

### 7.1 原规则适用范围调整

- `.trae/rules/agent-memory-management.md` 中的严格内存限制**仅适用于本地子 agent 并行加载源码场景**。
- 远程验证任务**不受本地内存限制约束**。
- 远程服务器内存由运维团队保障，AI agent 无需感知。

### 7.2 保留的原则

- 单一职责：一个 Agent 只做一件事（仍然适用，避免任务混乱）。
- 分批加载：按需读取（仍然适用于本地源码加载）。
- 串行/并行选择：根据任务依赖关系选择（远程可更激进并行）。

### 7.3 调整的原则

- 内存阈值检查：远程任务不检查，本地任务宽松检查。
- 并发数限制：远程放开（建议 3-5），本地保持原限制。
- 熔断机制：远程不需要，本地保留。

## 八、版本记录

| 版本 | 日期       | 变更内容                           |
| ---- | ---------- | ---------------------------------- |
| 1.0  | 2026-08-01 | 初始版本，明确远程验证环境执行规则 |
