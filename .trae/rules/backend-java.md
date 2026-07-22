---
alwaysApply: false
description: 编辑 services/core/ 下的 Java Spring Boot 核心业务服务代码时使用该规则
globs: services/core/**
---

# Java 核心业务服务规则（Java 21 + Spring Boot 3.4）

## 框架约束

- Java 21，启用虚拟线程（`spring.threads.virtual.enabled: true`）。
- Spring Boot 3.4，使用 starter 依赖管理。
- 数据访问使用 Spring Data JPA + Flyway 迁移。
- 数据库为 PostgreSQL 16，使用 PostGIS 扩展。
- 对象存储使用 S3 API（开发环境 MinIO）。

## 包结构

```
com.platform.core
├── CoreApplication.java     # 启动类
├── health/                  # 健康检查
├── config/                  # 配置类
├── domain/                  # 领域模型（Entity + Value Object）
├── repository/              # 仓储接口（Spring Data JPA）
├── service/                 # 应用服务
├── controller/              # REST 控制器
├── dto/                     # 数据传输对象
└── event/                   # 领域事件
```

## 编码规范

- 缩进 4 空格（见 `.editorconfig`）。
- 类名 PascalCase，方法名 camelCase，常量全大写下划线。
- 使用 Record 定义不可变 DTO 和 Value Object。
- 使用 `@Validated` + `@Valid` 进行参数校验。
- 异常使用 `@ControllerAdvice` 统一处理。

## 数据库迁移

- Flyway 脚本放 `src/main/resources/db/migration/`。
- 命名格式：`V{version}__{description}.sql`（如 `V1__init_schema.sql`）。
- 迁移脚本不可修改，只新增。

## API 设计

- REST API 路径与 `design/r2-contract-catalog/` 中分配的稳定 ID 一致。
- 使用 `@Transactional` 标注事务边界。
- 领域事件通过 Spring Application Event 或 Outbox 模式发布。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_HOST` | localhost | 数据库地址 |
| `DB_PORT` | 5432 | 数据库端口 |
| `DB_NAME` | design_platform | 数据库名 |
| `DB_USER` | platform | 数据库用户 |
| `DB_PASSWORD` | — | 数据库密码 |
| `S3_ENDPOINT` | http://localhost:9000 | S3 端点 |
| `S3_ACCESS_KEY` | — | S3 访问密钥 |
| `S3_SECRET_KEY` | — | S3 密钥 |

## 测试

- 使用 JUnit 5 + Spring Boot Test。
- 数据库测试使用 TestContainers（PostgreSQL）。
- 测试命令：`./mvnw test`。

## Spring Boot 编码约束

### 依赖注入

- 构造器注入 + Lombok `@RequiredArgsConstructor`
- 禁止 `@Autowired` 字段注入（字段注入难以测试）

### Controller 约束

- Controller 用 `@RestController` + `@RequestMapping`
- Controller 只做参数绑定 + 调 Service，禁止写业务逻辑
- Service 不得直接操作 `HttpServletRequest`（抽到 Controller 层）

### 异常处理

- 使用 `@ControllerAdvice` 全局异常处理，统一返回 `ApiResponse<T>` 结构
- 异常分类：业务异常（4xx + 业务码）vs 系统异常（5xx）

### 依赖管理

- 使用 Spring Boot BOM 统一版本
- 禁止 `SNAPSHOT` 版本进入生产

### JVM 调优（Hybrid-Site 部署必备）

生产启动参数：
```bash
java -Xms2g -Xmx2g \
     -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -XX:+HeapDumpOnOutOfMemoryError \
     -jar app.jar
```

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `-Xms` / `-Xmx` | 相等 | 避免动态扩缩抖动 |
| GC | G1GC（>4GB 堆） | Java 21 默认 G1 |
| HeapDump | 生产必须开启 | OOM 时自动 dump |

### 测试与质量门禁

- 测试分层：JUnit 5 + Mockito（单测）/ `@SpringBootTest`（集成）
- 使用 TestContainers（PostgreSQL）做集成测试
- `jacoco` 覆盖率 ≥ 80%（建筑专业核心模块建议 ≥ 85%）
- ArchUnit 架构检查：禁止 Service 反向依赖 Controller
- Checkstyle / SpotBugs / PMD 强制 lint

## 微服务边界约束

- BFF（NestJS）/ 核心服务（Java）/ AI 服务（Python）各自自有数据库
- 禁止服务间直接访问彼此数据库，必须通过 API/Event
- 跨服务事务（如设计版本状态流转）用 Saga 编排，必须有补偿动作
- 跨服务事件用 Outbox 模式：业务表 + outbox 表同一事务，Poller 异步发消息
- 服务间依赖至少 1 个契约测试（Pact）
- 分布式追踪用 OpenTelemetry（云控制面 Jaeger / Tempo）
