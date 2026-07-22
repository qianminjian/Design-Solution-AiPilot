---
alwaysApply: true
description: 多语言测试统一规范——覆盖率、分层、Mock、TDD、CI 门禁，始终生效
---

# 多语言测试统一规则

> 来源：PrismScan L2-project 规则适配

## 适用范围

本规则适用于本项目全部技术栈的测试编写与 CI 门禁，始终生效：
- 前端 / BFF（TypeScript）：Vitest + MSW + Playwright
- 核心业务服务（Java 21 + Spring Boot 3.4）：JUnit 5 + Mockito + TestContainers
- AI 服务（Python 3.12 + FastAPI）：pytest + pytest-asyncio + pytest-mock

## 1. 覆盖率基线

| 范围 | 覆盖率要求 |
|------|-----------|
| 总覆盖率 | ≥ 80% |
| 建筑专业核心模块 | ≥ 85% |
| 新增代码 diff 覆盖率 | = 100% |
| AI 审签路径（人工复核触发条件） | = 100% |
| 异常路径（网络失败 / DB 错误 / 超时） | ≥ 80% |

- 覆盖率不达标阻断 CI 合并。
- 覆盖率仅作为下限指标，不追求无意义的数字——关键业务路径与异常路径优先于行覆盖率。

## 2. 测试分层

| 层级 | TypeScript | Python | Java | 范围 |
|------|-----------|--------|------|------|
| 单元测试 | Vitest | pytest | JUnit 5 + Mockito | 单个函数 / 类，无外部依赖 |
| 集成测试 | Vitest + MSW | pytest + httpx | @SpringBootTest + TestContainers | 模块间协作、数据库、HTTP |
| E2E 测试 | Playwright | — | — | 核心用户流程（登录→上传→AI 生成→复核→发布） |

- E2E 核心流程覆盖率 = 100%（从境外主创草图上传到方案深化的完整链路）。
- E2E 测试在 CI 中独立 stage 运行，失败阻断部署。

## 3. 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 单元测试 | `*.test.{ts,tsx,py}` / `*Test.java` | `projectService.test.ts`、`test_project_service.py`、`ProjectServiceTest.java` |
| 集成测试 | `*.test.{ts,tsx,py}` / `*IT.java` | `projectApi.test.ts`、`test_project_api.py`、`ProjectControllerIT.java` |
| E2E 测试 | `*.spec.ts` | `design-upload.spec.ts` |
| 基础设施 | `tests/__support__/` | `tests/__support__/fixtures.ts` |

- 源码与测试物理隔离（与 coding-standards.md 第 60 条一致），所有测试文件统一放在 `tests/` 目录下，禁止在 `src/` 源码目录内放置测试文件。
- Java 服务遵循 Maven 标准结构：`src/main/java/`（源码）+ `src/test/java/`（测试），单元测试与集成测试通过包名和后缀区分。
- Java 集成测试以 `IT` 后缀结尾，单元测试以 `Test` 后缀结尾，便于 Maven Surefire / Failsafe 分离执行。

### 3.1 各服务测试目录结构

#### TypeScript（apps/web、apps/bff、packages/shared）

```
<package>/
├── src/                          # 源码目录（禁止放测试文件）
└── tests/
    ├── unit/                     # 单元测试：单个函数/类，无外部依赖
    │   ├── components/
    │   ├── services/
    │   ├── hooks/
    │   └── utils/
    ├── integration/              # 集成测试：模块间协作、HTTP、数据库
    │   ├── api/
    │   └── pages/
    ├── e2e/                      # E2E 测试：核心用户流程（仅前端）
    │   └── *.spec.ts
    └── __support__/              # 测试基础设施
        ├── fixtures.ts           # 测试数据
        ├── mocks/                # Mock 实现
        ├── setup.ts              # 全局 setup
        └── test-utils.ts         # 测试工具函数
```

#### Java（services/core）

```
services/core/src/
├── main/java/com/platform/core/  # 源码目录（禁止放测试文件）
└── test/java/com/platform/core/
    ├── unit/                     # 单元测试（*Test.java）
    │   ├── service/
    │   ├── domain/
    │   └── util/
    └── integration/              # 集成测试（*IT.java）
        ├── controller/
        ├── repository/
        └── config/
```

#### Python（services/ai）

```
services/ai/
├── src/                          # 源码目录（禁止放测试文件）
└── tests/
    ├── unit/                     # 单元测试
    │   ├── test_*.py
    │   └── ...
    ├── integration/              # 集成测试
    │   ├── test_*.py
    │   └── ...
    ├── conftest.py               # pytest 全局 fixtures
    └── __support__/              # 测试基础设施
        ├── fixtures.py
        └── mocks/
```

## 4. Mock 规范（关键）

### 4.1 强制 Mock 清单

| 对象 | Mock 工具 | 原因 |
|------|----------|------|
| 外部 HTTP API | MSW（TS）/ pytest-mock（Python）/ Mockito（Java） | 避免真实网络依赖 |
| LLM 调用 | vi.fn() / pytest-mock / Mockito | 禁止测试中调用付费 API |
| 数据库（集成测试） | TestContainers | 真实 PostgreSQL 16 隔离环境 |
| 文件系统 | 临时目录 / tmp_path | 避免污染工作区 |
| 时间 | vi.useFakeTimers / freezegun / Clock | 时间确定性 |

### 4.2 LLM 调用 Mock 红线

- **禁止在测试中真实调用付费 API**（OpenAI / Claude / 建筑专业 AI）。
- LLM 调用必须 Mock 返回固定 fixture，确保测试确定性。
- CI 中扫描测试文件，发现真实付费 API URL（`api.openai.com` / `api.anthropic.com`）即报错。

```typescript
// 正确：Mock LLM 调用
vi.mock('@/services/llm-client', () => ({
  generateDesign: vi.fn().mockResolvedValue({
    content: 'mocked design output',
    traceId: 'test-trace-001',
  }),
}));

// 禁止：测试中真实调用付费 API
// const result = await generateDesign(prompt); // 真实调用 OpenAI
```

```python
# 正确：Mock LLM 调用
from unittest.mock import AsyncMock

@patch("src.services.llm_client.generate_design", new_callable=AsyncMock)
async def test_design_generation(mock_generate):
    mock_generate.return_value = {"content": "mocked", "trace_id": "test-001"}
    result = await design_service.generate("prompt")
    assert result["content"] == "mocked"
```

### 4.3 生产代码禁止测试分支

- 禁止 `if (process.env.NODE_ENV === 'test')` 分支进入生产代码。
- 测试依赖通过依赖注入传入，不通过环境变量条件判断。

```typescript
// 禁止：生产代码中的测试分支
function loadData() {
  if (process.env.NODE_ENV === 'test') {
    return mockData; // 污染生产代码
  }
  return fetch('/api/data');
}

// 正确：依赖注入
function loadData(client: DataClient = defaultClient) {
  return client.fetch();
}
```

## 5. AAA 模式

所有测试遵循 Arrange → Act → Assert 三段式结构。

### 5.1 TypeScript 示例

```typescript
describe('ProjectService', () => {
  it('应该拒绝空用户名登录', async () => {
    // Arrange（准备）
    const input = { username: '', password: 'validPass123' };

    // Act（执行）
    const result = await authService.login(input);

    // Assert（断言）
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(101);
  });
});
```

### 5.2 Python 示例

```python
class TestAuthService:
    """认证服务测试"""

    async def test_应该拒绝空用户名登录(self, auth_service):
        # Arrange（准备）
        input_data = {"username": "", "password": "validPass123"}

        # Act（执行）
        result = await auth_service.login(input_data)

        # Assert（断言）
        assert result["success"] is False
        assert result["error_code"] == 101
```

### 5.3 Java 示例

```java
class AuthServiceTest {

    @Test
    @DisplayName("应该拒绝空用户名登录")
    void shouldRejectEmptyUsername() {
        // Arrange（准备）
        var input = new LoginRequest("", "validPass123");

        // Act（执行）
        var result = authService.login(input);

        // Assert（断言）
        assertFalse(result.isSuccess());
        assertEquals(101, result.getErrorCode());
    }
}
```

## 6. 测试命名

- 测试名称描述**行为**，而非**实现**。
- 使用"应该……"句式，描述被测对象的业务行为。

| 正确（描述行为） | 错误（描述实现） |
|-----------------|-----------------|
| 应该拒绝空用户名登录 | testLogin |
| 应该在密码错误3次后锁定账户 | checkPassword |
| 应该对超出100层的建筑标记为超高层 | validateHeight |

## 7. TDD 六步法

1. **写测试**：先写一个失败的测试，描述期望行为。
2. **跑测试**：确认测试失败（红灯）。
3. **写代码**：写最少量的代码使测试通过。
4. **跑测试**：确认测试通过（绿灯）。
5. **重构**：优化代码结构，保持测试通过。
6. **重复**：进入下一个测试循环。

- 修复 Bug 时须先写复现测试（回归测试），再修复代码。
- AI 审签路径的 Bug 修复必须附带人工复核触发条件的测试。

## 8. 多框架配置

| 框架 | 单测超时 | 集成超时 | 覆盖率工具 | 命令 |
|------|---------|---------|-----------|------|
| Vitest | 5s | 10s | @vitest/coverage-v8 | `pnpm test --coverage` |
| pytest | 30s | 60s | pytest-cov（`--cov-fail-under=80`） | `pytest --cov=src --cov-fail-under=80` |
| JUnit 5 | @Timeout(2) | @Timeout(10) | JaCoCo（line ≥ 80%, branch ≥ 70%） | `./mvnw test jacoco:report` |

### 8.1 Vitest 配置要点

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, branches: 70 },
    },
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
```

### 8.2 pytest 配置要点

```ini
# pyproject.toml [tool.pytest.ini_options]
[tool.pytest.ini_options]
asyncio_mode = "auto"
timeout = 30

[tool.coverage.run]
source = ["src"]
omit = ["tests/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

### 8.3 JUnit 5 + JaCoCo 配置要点

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit><counter>LINE</counter><minimum>0.80</minimum></limit>
                    <limit><counter>BRANCH</counter><minimum>0.70</minimum></limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</plugin>
```

## 9. CI 门禁

### 9.1 覆盖率门禁

- 覆盖率不达标 → CI 阻断合并。
- 新增代码 diff 覆盖率 < 100% → CI 阻断合并。

### 9.2 跳过测试扫描

CI 中扫描代码，发现以下跳过测试的模式即报错：

```bash
# 扫描跳过的测试
grep -rE "(it|test)\.skip|@Skip|pytest\.skip|@Disabled" --include="*.ts" --include="*.py" --include="*.java" .
```

- 跳过测试须附带 issue 编号与原因注释，且不超过 1 个 sprint。
- 无注释的 `skip` 直接 CI 报错。

### 9.3 Mock 验证

- 扫描测试文件，发现真实付费 API URL（`api.openai.com` / `api.anthropic.com` / `api.eviai.com`）即报错。
- 扫描测试文件，发现真实数据库连接串（非 TestContainers）即报错。

## 10. 边界值测试

每个公共函数至少覆盖以下边界值：

| 边界类型 | 示例 |
|---------|------|
| 空值 | `""` / `[]` / `{}` |
| null / undefined / None | `null` / `undefined` / `None` |
| 超长输入 | 10000 字符字符串 |
| 并发 | 100 并发请求 |
| 极值 | `MAX_INT` / `0` / 负数 |
| 边界值 | 建筑层数 5（下限）/ 15（上限）/ 16（超限） |

## 11. 异常路径测试

每个外部依赖调用须覆盖以下异常路径：

| 异常类型 | 测试场景 |
|---------|---------|
| 网络失败 | 连接超时 / DNS 解析失败 / 连接重置 |
| 数据库错误 | 死锁 / 连接池耗尽 / 约束冲突 |
| 超时 | 下游服务超时 / LLM Provider 超时 |
| LLM Provider 异常 | 429 限流 / 500 服务端错误 / 响应格式异常 |
| 文件系统异常 | 磁盘满 / 权限拒绝 / 文件不存在 |
| AI 审签异常 | AI 输出被人工复核驳回 / 风险等级升级 |

```typescript
it('应该在 LLM Provider 超时时返回降级响应', async () => {
  // Arrange
  vi.mocked(llmClient.generate).mockRejectedValue(new TimeoutError('LLM timeout'));

  // Act
  const result = await designService.generateWithFallback('prompt');

  // Assert
  expect(result.degraded).toBe(true);
  expect(result.errorCode).toBe(599);
});
```
