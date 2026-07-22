---
alwaysApply: true
description: 通用编码规范、命名约定、代码质量要求——所有语言通用
---

# 通用编码规范

## 基本原则

- 所有回答和代码注释使用中文表述。
- 为关键逻辑和可能造成理解困难的部分添加简明的中文注释。
- 生成的代码超过 20 行时，优先考虑是否可以进行适当的抽象或聚合。
- 避免不必要的对象复制或克隆。
- 避免多层嵌套，提前返回（guard clause）。
- 函数只做一件事，保持适当的抽象层次。

## 命名约定

| 语言 | 变量/函数 | 类/接口 | 文件 |
|------|----------|---------|------|
| TypeScript | camelCase | PascalCase | kebab-case.ts / PascalCase.tsx |
| Java | camelCase | PascalCase | PascalCase.java |
| Python | snake_case | PascalCase | snake_case.py |

- 使用有意义的、描述性名称，避免缩写和单字母变量（循环索引 `i`、`j` 除外）。
- 常量使用全大写 + 下划线：`MAX_RETRY_COUNT`。
- 布尔变量以 `is`/`has`/`should` 开头：`isLoading`、`hasPermission`。

## 代码质量

- 注释解释"为什么"，而不是"做什么"。
- 为公共 API 提供清晰的文档。
- 更新注释以反映代码变化。
- 新建或修改代码后确保对应的测试通过。
- 遵循 `.editorconfig` 配置：空格缩进、LF 换行、UTF-8、去尾部空格。

## 错误处理

- 不吞异常，明确处理或向上传播。
- 使用项目定义的错误码体系（见设计文档 D35）。
- 外部调用须设置超时和重试策略。
- AI 调用结果须按风险等级进入人工复核流程。

## 依赖管理

- TypeScript 依赖通过 pnpm workspace 管理，共享类型放 `packages/shared/`。
- Java 依赖通过 Maven `pom.xml` 管理。
- Python 依赖通过 `pyproject.toml` 管理。
- 不引入设计文档未批准的新依赖；引入前须评估安全性和许可证。

## Git 工作流

- 频繁提交，保持代码随时可工作。
- 每次提交后运行测试确保行为不变。
- 重构时小步进行：每次只做一个小改动，然后测试。

## 核心工程原则（语言无关）

### 10 大 DO
1. 源码与测试分离：src/ 与 tests/ 物理隔离，禁止源码内放测试文件
2. 显式优于隐式：TS strict / Python mypy strict / Java 强类型；配置从环境变量注入
3. 单一职责：函数 < 50 行，一个模块一个领域
4. 及早失败：启动校验配置完整性，输入边界立即校验，CI lint + test 门禁
5. 幂等优先：写操作支持重试，AI 调用支持断点续传
6. 最小权限：API Token 限定 scope，DB 用户限定权限，服务间走内部网络
7. 可观测性内置：结构化日志（JSON）+ 关键路径 Metrics + 错误自动上报
8. 约定优于配置：遵循 pnpm workspace + Turborepo 约定
9. 渐进式采用：新增代码必须合规（hold-the-line）
10. 文档即代码：design/decisions/ ADR + design/BEACON.md 决策日志

### 禁止项
- 禁止隐式 any / 魔法数字
- 禁止吞异常、返回 null
- 禁止"万能工具类"
- 禁止生产用 root/admin
- 禁止仅靠 console.log 排查问题
- 禁止"代码自解释"作为不写文档的理由

## 代码风格补充（多语言通用）

### TypeScript 严格模式（apps/web + apps/bff + packages/shared）

7 项全开：
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `exactOptionalPropertyTypes: true`
- `noFallthroughCasesInSwitch: true`

### 错误处理

- 捕获必须记录上下文（url/method/status/error）
- 异步函数必须 try-catch
- AI 调用结果按风险等级进入人工复核（见 design-constraints.md）

### 精度要求

- 货币用 big.js（JS）/ BigDecimal（Java）/ Decimal（Python）
- 建筑坐标用 Decimal / BigDecimal，禁止 float/double
- DB 用 NUMERIC(20,4) 或更精确定点

### 文件行数上限

- 动态语言（TS/Python）：≤ 300 行
- 静态语言（Java）：≤ 400 行
- 单函数 ≤ 30 行，嵌套 ≤ 3 层

### 目录约定

- kebab-case 目录名，单目录 ≤ 8 个文件
- 按业务功能分组（如 transfer/、drawing-review/），不按技术类型
- 禁止 util/、common/、misc/ 无意义目录名

### 临时文件与产物管理

- 本地临时工作目录使用 `tmp/` 或 `temp/`，已在 `.gitignore` 中忽略，禁止提交。
- 草稿/试验代码使用 `.scratch/` 或 `_scratch/` 目录，已在 `.gitignore` 中忽略，禁止提交。
- 覆盖率报告统一输出到 `coverage/`（TS/Java）或 `htmlcov/`（Python），禁止提交。
- 测试输出（Playwright 报告、Vitest 输出等）统一在 `test-results/` 或各工具默认目录，禁止提交。
- 构建产物（`dist/`、`build/`、`out/`、`target/`）禁止提交，由 CI 生成。
- 设计源文件（`.rvt`、`.dwg`、`.3dm`、`.skp`、`.ifc` 等）走对象存储（S3/MinIO），禁止提交到 Git。
- 大文件（>10MB）须走对象存储或 Git LFS，禁止直接提交到 Git 仓库。
- 日志文件（`*.log`）禁止提交，由可观测性系统统一采集。

### 禁止项（补充）
- 禁止 any / as any / @ts-ignore（用 unknown + type guard）
- 禁止 console.log 残留（用 logger）
- 禁止空 catch {}（必须记录 + 处理）
- 禁止魔术数字 / magic string（用常量/枚举）
- 禁止隐式类型转换（用 ===）
