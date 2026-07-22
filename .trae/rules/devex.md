---
alwaysApply: false
globs: .vscode/**, *.config.*, package.json, pyproject.toml, pom.xml
---

> 来源：PrismScan L2-project 规则适配

# 开发体验规范（DevEx）

适用范围：编辑器配置（.vscode/）、构建与工具配置（*.config.*）、依赖清单（package.json / pyproject.toml / pom.xml）。
本规范统一开发环境配置，确保新成员 30 分钟内完成环境搭建并进入开发状态。

## 一、VSCode 必装扩展（.vscode/extensions.json）

项目根目录 `.vscode/extensions.json` 须声明以下扩展推荐，团队成员克隆仓库后 VSCode 自动提示安装：

### 1.1 通用扩展

| 扩展 | 用途 |
|------|------|
| ESLint | TypeScript / JavaScript 代码检查 |
| Prettier | 代码格式化 |
| EditorConfig | 跨编辑器统一缩进与换行 |
| GitLens | Git 历史与 blame 增强 |
| GitHub Pull Requests | PR 评审与管理 |
| Docker | Dockerfile 与 Compose 支持 |

### 1.2 测试扩展

| 扩展 | 用途 |
|------|------|
| Vitest Explorer | Vitest 测试资源管理器（前端/BFF） |
| Playwright Test | E2E 测试运行与管理 |

### 1.3 语言专属扩展

| 扩展 | 适用目录 | 用途 |
|------|----------|------|
| Java Extension Pack | services/core | Java 语言支持与调试 |
| Python + Pylance | services/ai | Python 语言支持与类型检查 |

### 1.4 数据库与存储客户端

| 扩展 | 用途 |
|------|------|
| PostgreSQL（如 `ckolkman.vscode-postgres`） | PostgreSQL 16 连接与查询 |
| MinIO 客户端（或 S3 Explorer） | 开发环境对象存储浏览 |

### 1.5 推荐配置示例

`.vscode/extensions.json`：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "editorconfig.editorconfig",
    "eamodio.gitlens",
    "github.vscode-pull-request-github",
    "ms-azuretools.vscode-docker",
    "vscjava.vscode-java-pack",
    "ms-python.python",
    "ms-python.vscode-pylance"
  ]
}
```

## 二、VSCode settings.json

项目根目录 `.vscode/settings.json` 须统一以下配置，确保保存即格式化：

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true
  },
  "[java]": {
    "editor.formatOnSave": true
  },
  "[markdown]": {
    "files.trimTrailingWhitespace": false
  }
}
```

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `editor.formatOnSave` | `true` | 保存时自动格式化 |
| `editor.codeActionsOnSave` | `source.fixAll.eslint` + `source.organizeImports` | 保存时自动修复 ESLint 问题与整理 import |
| `typescript.tsdk` | `node_modules/typescript/lib` | 使用工作区 TypeScript 版本 |
| `files.eol` | `\n` | 统一 LF 换行 |
| `files.insertFinalNewline` | `true` | 文件末尾插入空行 |
| `files.trimTrailingWhitespace` | `true` | 去除行尾空格（Markdown 除外） |

## 三、本地服务编排（docker/compose.yml）

开发环境依赖通过 `docker/compose.yml` 一键启动，包含以下服务：

| 服务 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| PostgreSQL | `postgres:16` | 5432 | 主数据库 |
| MinIO | `minio/minio` | 9000（API）/ 9001（Console） | 开发环境对象存储（S3 兼容） |

### 3.1 项目端口约定

各服务端口固定，避免冲突：

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| Web（Next.js 15） | 3000 | `pnpm dev` |
| BFF（NestJS 11） | 3001 | `pnpm dev`（workspace 内） |
| Core（Spring Boot 3.4） | 8080 | `cd services/core && ./mvnw spring-boot:run` |
| AI（FastAPI） | 8000 | `cd services/ai && uvicorn src.main:app --reload` |

## 四、新人 30 分钟上手流程

新成员加入项目后，按以下步骤 30 分钟内完成环境搭建并启动开发：

```bash
# 1. 克隆仓库
git clone <repo-url> Design-Solution-AiPilot
cd Design-Solution-AiPilot

# 2. 复制环境变量模板
cp .env.example .env

# 3. 启动本地依赖服务（PostgreSQL + MinIO）
docker compose -f docker/compose.yml up -d

# 4. 安装依赖
pnpm install

# 5. 启动开发服务（web + bff）
pnpm dev
```

- `.env.example` 须包含所有必需环境变量及默认值，新成员复制即可用。
- 启动后访问 `http://localhost:3000` 验证 Web 工作台，`http://localhost:8080/health` 验证 Core 服务。
- Java/Python 服务按需单独启动（见上表命令）。

## 五、debug 库替代 console.log

### 5.1 使用规范

- 前端/BFF 开发调试使用 [`debug`](https://www.npmjs.com/package/debug) 库，**禁止** `console.log` 进入生产代码。
- `debug` 库通过命名空间控制输出，默认静默，按需开启。

```typescript
import debug from 'debug';

const log = debug('app:bff:project-service');

// 调试时通过环境变量开启
// DEBUG=app:* pnpm dev
log('查询项目列表: userId=%s', userId);
```

### 5.2 命名空间约定

- 格式：`app:<service>:<module>`，如 `app:bff:project-service` / `app:web:design-review`。
- 开启方式：`DEBUG=app:* pnpm dev`（全量）或 `DEBUG=app:bff:* pnpm dev`（按服务）。

### 5.3 生产禁令

- 生产代码**禁止** `console.log`（正式日志见可观测性规范，使用 Pino）。
- `debug` 库在生产环境默认不输出（需显式设置 `DEBUG` 环境变量），可保留在代码中供临时排查。

## 六、DevEx 指标表格

开发体验须满足以下性能指标，CI 须监控并在超阈值时告警：

| 指标 | 阈值 | 说明 |
|------|------|------|
| 首次 build | < 60s | 全量构建（clean build）耗时 |
| 增量 build | < 5s | 增量构建（watch 模式单次）耗时 |
| 单元测试 | < 30s | `pnpm test` 全量单测耗时 |
| lint | < 10s | `pnpm lint` 全量检查耗时 |
| 新人 setup | < 30 min | 从克隆到本地服务跑通的总时长 |

- 超阈值时优先排查：依赖膨胀、配置冗余、测试慢查询。
- 指标退化趋势记入 BEACON.md，作为技术债跟踪。

## 七、.editorconfig（跨语言统一）

项目根目录 `.editorconfig` 须统一跨语言缩进与换行规范：

```ini
root = true

[*]
indent_style = space
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.py]
indent_size = 4

[*.java]
indent_size = 4

[*.{ts,tsx,js,jsx,json,yml,yaml,css}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

| 文件类型 | 缩进 | 特殊规则 |
|----------|------|----------|
| 通用（`*`） | space / LF / UTF-8 / 去尾空格 | 基线规则 |
| `*.py` / `*.java` | 4 空格 | Python 与 Java 服务代码 |
| `*.ts` / `*.tsx` / `*.json` / `*.yml` | 2 空格 | TypeScript 与配置文件 |
| `*.md` | — | 保留行尾空格（Markdown 换行依赖） |

## 八、端口冲突检查

启动本地服务前，检查端口是否被占用，避免启动失败：

```bash
# 检查指定端口
lsof -i:3000
lsof -i:3001
lsof -i:8080
lsof -i:8000
lsof -i:5432
lsof -i:9000

# 一键检查所有项目端口
for port in 3000 3001 8080 8000 5432 9000 9001; do
  echo "Port $port: $(lsof -i:$port | tail -n +2 || echo 'free')"
done
```

- 端口被占用时，先确认是否为本项目遗留进程（`kill` 后重启），再考虑是否需调整端口。
- 禁止随意修改项目端口约定（见第三章），避免团队成员端口不一致。

## 九、Husky + lint-staged

### 9.1 Git Hooks 配置

项目使用 [Husky](https://typicode.github.io/husky/) 管理 Git Hooks，[lint-staged](https://github.com/lint-staged/lint-staged) 对暂存文件执行检查：

| Hook | 时机 | 执行内容 |
|------|------|----------|
| pre-commit | `git commit` 前 | 对暂存文件运行 `eslint --fix` + `prettier --write` |
| commit-msg | 提交信息校验时 | 运行 `commitlint` 校验 Conventional Commits 格式 |

### 9.2 配置示例

`package.json`：

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,yml,yaml,css,md}": [
      "prettier --write"
    ]
  }
}
```

`.husky/pre-commit`：

```bash
#!/usr/bin/env sh
npx lint-staged
```

`.husky/commit-msg`：

```bash
#!/usr/bin/env sh
npx --no-install commitlint --edit "$1"
```

### 9.3 规则说明

- pre-commit 仅检查**暂存文件**（lint-staged），不阻塞全量 lint，保证提交速度。
- commit-msg 校验提交信息符合 Conventional Commits（见 `git-commit-message.md` 规则）。
- 紧急情况可使用 `git commit --no-verify` 跳过 Hooks，但须在 PR 中说明理由，禁止常态化跳过。
