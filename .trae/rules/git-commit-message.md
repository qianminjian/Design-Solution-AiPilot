---
scene: git_message
description: Git 提交信息格式规范——生成提交内容时生效
---

# Git 提交信息规范

## 格式

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

## type 取值

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（非 feat 非 fix） |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖 |
| `ci` | CI 配置 |
| `design` | 设计文档变更 |

## scope 取值

| scope | 说明 |
|-------|------|
| `web` | 前端（apps/web） |
| `bff` | BFF（apps/bff） |
| `core` | 核心服务（services/core） |
| `ai` | AI 服务（services/ai） |
| `shared` | 共享包（packages/shared） |
| `design` | 设计文档（design/） |
| `rules` | Trae 规则（.trae/rules/） |
| `infra` | 基础设施（docker/、ci） |

## 示例

```
feat(web): 新增项目列表页面

- 使用 Ant Design Table 组件
- 接入 BFF /project/list API
- 支持分页和搜索

docs(design): 整合业界对标审计补充至 D12/D20/D24

- 新增 14 个补充章节（795 行）
- 适配 D46.13.1 OD 表为 R1 冻结状态
- 更新 BEACON.md 演进日志
```

## 规则

- subject 不超过 50 字符，使用中文描述。
- body 每行不超过 72 字符，说明"为什么"而非"做了什么"。
- 涉及设计文档变更时使用 `design` type。
- 涉及 Trae 规则变更时使用 `chore` type + `rules` scope。

## Git 工作流补充（分支 + PR + 依赖）

### 分支命名

- feat/fix/refactor/docs/hotfix/release + kebab-case
- 必要时带工单号：feat/jira-1234-user-login

### 分支保护（main）

- 禁止直接 push
- PR ≥ 1 人 approve + CI 全绿
- squash & merge

### PR 大小

- 建议 ≤ 500 行，强制 ≤ 1500 行
- 重构与功能修改分两个 PR

### 双签 Review（2 人 approve）

- DB schema 变更（Flyway migration）
- 安全配置（密钥、权限、CORS、CODEOWNERS）
- 外部 AI Provider 接入（EVAI/小库 AI/建筑学长）
- 生产环境配置（Hybrid-Site 部署）
- 契约变更（参考 design/r2-contract-catalog/）

### 依赖管理

- pnpm workspace：必须提交 pnpm-lock.yaml + save-exact: true
- 0 high/critical 漏洞（pnpm audit + snyk test）
- 新增依赖必须审批（评估安全性和许可证）
- 禁止 GPL/AGPL，允许 MIT / Apache 2.0 / BSD / ISC
- 不引入设计文档未批准的新依赖（见 design-constraints.md）

### Husky + lint-staged

- pre-commit：eslint --fix + prettier --write + tsc --noEmit
- commit-msg：commitlint（12 type 严格一致）

### Hotfix 流程

1. 从 main 创建 hotfix/<issue>
2. PR 到 main（标记 P0）
3. 合并后立即 tag
4. 24h 内补工单 + Postmortem

### 依赖更新策略

| 类型 | 风险 | 策略 |
|------|------|------|
| patch (x.x.X) | 低 | 自动 merge（CI 全绿） |
| minor (x.X.0) | 中 | dev 依赖自动 / 生产依赖评审 |
| major (X.0.0) | 高 | 必须人工评审 + 升级文档 |
| security | 最高 | Critical 4h / High 24h |
