---
alwaysApply: false
description: PostgreSQL 16 + Flyway 数据库规范——编辑 services/core/ 或 apps/bff/ 时生效
globs: services/core/**, apps/bff/**
---

# PostgreSQL 16 + Flyway 数据库规则

> 来源：PrismScan L2-project 规则适配

## 适用范围

本规则适用于核心业务服务（Java 21 + Spring Boot 3.4）和 BFF（NestJS 11）中涉及数据库操作的代码，包括 Flyway 迁移脚本、JPA Entity、SQL 查询、事务管理。

## 1. 命名约定

| 对象 | 规则 | 示例 |
|------|------|------|
| 表名 | snake_case，复数 | `projects`、`design_revisions` |
| 列名 | snake_case | `created_at`、`project_name` |
| 主键 | `id` | `id` |
| 外键 | `<table>_id` | `project_id` |
| 索引 | `idx_<table>_<columns>` | `idx_projects_owner_id` |
| 唯一约束 | `uk_<table>_<columns>` | `uk_users_email` |
| 外键约束 | `fk_<table>_<ref_table>` | `fk_revisions_projects` |
| 检查约束 | `ck_<table>_<desc>` | `ck_projects_floor_count` |

## 2. 审计字段（强制）

每张业务表必须包含以下审计字段：

```sql
-- 审计字段标准模板
CREATE TABLE projects (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,

    -- 审计字段（强制）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  BIGINT      NOT NULL,  -- 创建人 user_id
    updated_by  BIGINT      NOT NULL,  -- 更新人 user_id
    deleted_at  TIMESTAMPTZ,           -- 软删除时间，NULL 表示未删除
    version     INT         NOT NULL DEFAULT 1,  -- 乐观锁版本号

    CONSTRAINT uk_projects_name UNIQUE (name)
);

-- 审计字段索引
CREATE INDEX idx_projects_created_at ON projects (created_at);
CREATE INDEX idx_projects_deleted_at ON projects (deleted_at) WHERE deleted_at IS NULL;

-- updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- `deleted_at` 用于软删除，查询时加 `WHERE deleted_at IS NULL` 过滤。
- `version` 用于乐观锁，JPA 使用 `@Version` 注解。

## 3. 类型选择

| 用途 | 推荐类型 | 禁止类型 | 原因 |
|------|---------|---------|------|
| 主键 | `BIGSERIAL` 或 `UUID` | `INT` | INT 容量不足，BIGSERIAL 自增高效 |
| 字符串（定长） | `VARCHAR(N)` | `CHAR(N)` | CHAR 浪费空间 |
| 字符串（不定长） | `TEXT` | — | 长文本用 TEXT |
| 时间 | `TIMESTAMPTZ` | `TIMESTAMP`（无时区） | 境外部署必须带时区（OD-01） |
| 货币 | `NUMERIC(20,4)` | `FLOAT` / `DOUBLE` | 浮点精度丢失 |
| 布尔 | `BOOLEAN` | `INT` | 语义明确 |
| JSON | `JSONB` | `TEXT` 存 JSON | JSONB 支持索引与查询 |
| 枚举 | `VARCHAR(50)` + CHECK | PostgreSQL ENUM | ENUM 修改需 DDL，不灵活 |
| 几何数据 | PostGIS `geometry` / `geography` | — | 建筑平面图坐标 |
| 大整数 | `BIGINT` | `INT` | 避免溢出 |

## 4. 索引设计

- 复合索引遵循最左前缀原则，按查询频率从高到低排列列顺序。
- 软删除表使用部分索引：`CREATE INDEX ... WHERE deleted_at IS NULL`。
- 单表索引数 ≤ 5 个，避免过度索引影响写入性能。
- 低基数列（如 `is_active`）不单独建索引，应并入复合索引。
- 大表加索引用 `CREATE INDEX CONCURRENTLY`，避免锁表。

```sql
-- 正确：部分索引（软删除场景）
CREATE INDEX idx_projects_owner_status
    ON projects (owner_id, status)
    WHERE deleted_at IS NULL;

-- 禁止：低基数列单独索引
-- CREATE INDEX idx_projects_is_active ON projects (is_active);
```

## 5. 事务管理

- 显式事务边界，Java 使用 `@Transactional`，Python 使用 `with session.begin()`。
- 死锁重试：捕获 SQLSTATE `40001`（序列化失败）后重试最多 3 次，指数退避。
- 统一锁顺序：多表操作按表名字母序加锁，避免死锁。
- **禁止事务内调用外部 API**（含 LLM Provider），外部调用在事务外执行。
- 禁止长事务，目标事务执行时间 < 100ms。

```java
// 正确：事务内不调用外部 API
@Transactional
public void updateProject(Long projectId, UpdateRequest req) {
    Project project = repository.findById(projectId);
    project.update(req);
    repository.save(project);
    // 事务提交后发送事件
    eventPublisher.publishEvent(new ProjectUpdatedEvent(projectId));
}

// 禁止：事务内调用 LLM
// @Transactional
// public void generateDesign(Long projectId) {
//     String aiResult = llmClient.generate(prompt); // 禁止！外部 API 在事务内
//     ...
// }
```

## 6. Flyway 迁移规则

- 迁移脚本路径：`src/main/resources/db/migration/`。
- 命名格式：`V{version}__{description}.sql`（双下划线分隔版本号与描述）。
  - 示例：`V1__init_schema.sql`、`V2__add_projects_table.sql`、`V10__add_design_revisions.sql`
- **迁移脚本不可修改，只新增**——已执行的迁移修改会导致 checksum 不一致。
- 禁止手工修改生产 schema，所有变更通过 Flyway 迁移。
- 迁移脚本须在开发环境验证通过后提交 PR review。

## 7. 高风险迁移流程

| 操作类型 | 风险 | 流程 |
|---------|------|------|
| 加 NOT NULL 列 | 高 | 三步法：1. 加可空列 → 2. 回填数据 → 3. 下次发布改 NOT NULL |
| 删除列 | 中 | 两步法：1. 代码先停止读写该列 → 2. 下次发布执行 DROP COLUMN |
| 修改列类型 | 高 | 新列 + 双写 + 切流 + 删旧列（4 次发布） |
| 大表加索引 | 中 | `CREATE INDEX CONCURRENTLY`（不锁表） |
| 重命名列 | 中 | 加新列 + 双写 + 切流 + 删旧列（避免直接 RENAME） |
| DDL 生产执行 | 高 | 低峰期执行 + 双签 review（DBA + 开发负责人） |

### 7.1 NOT NULL 加列三步法示例

```sql
-- 第 1 次发布：加可空列
ALTER TABLE projects ADD COLUMN building_code VARCHAR(50);

-- 第 2 次发布：回填数据
UPDATE projects SET building_code = 'UNKNOWN' WHERE building_code IS NULL;

-- 第 3 次发布：改为 NOT NULL
ALTER TABLE projects ALTER COLUMN building_code SET NOT NULL;
ALTER TABLE projects ALTER COLUMN building_code SET DEFAULT 'UNKNOWN';
```

## 8. 慢查询监控

```ini
# postgresql.conf 慢查询监控配置
log_min_duration_statement = 500       # 记录执行超过 500ms 的查询
log_lock_waits = on                     # 记录锁等待
log_temp_files = 0                      # 记录临时文件使用
log_autovacuum_min_duration = 0         # 记录 autovacuum
```

- 慢查询告警接入 APM（Application Performance Monitoring）。
- 每周 review 慢查询 Top 10，建立优化 backlog。

## 9. SQL 注入防护

- 所有查询使用参数化查询或 ORM。
- 使用原生 SQL 时必须使用 `$1` / `?` 占位符绑定参数。
- **禁止字符串拼接 SQL**。

```java
// 正确：参数化查询
@Query("SELECT p FROM Project p WHERE p.name = :name AND p.status = :status")
List<Project> findByNameAndStatus(@Param("name") String name, @Param("status") Status status);

// 禁止：字符串拼接
// String jpql = "SELECT p FROM Project p WHERE p.name = '" + name + "'";
```

## 10. 最小权限

- 应用数据库账户只授予 `SELECT` / `INSERT` / `UPDATE` / `DELETE`。
- **禁止授予 `DROP` / `TRUNCATE` / DDL 权限**给应用账户。
- DDL 操作通过 Flyway 专用迁移账户执行（仅 CI/CD 管道使用）。
- 只读报表账户仅授 `SELECT`。

```sql
-- 应用账户权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 禁止授予 DDL
-- REVOKE CREATE ON SCHEMA public FROM app_user;
```

## 11. 备份策略（Hybrid-Site RPO ≤ 4h）

Hybrid-Site 部署模式下（OD-06），备份策略须满足 RPO ≤ 4h / RTO ≤ 8h：

| 备份类型 | 频率 | 保留时长 | 存储位置 |
|---------|------|---------|---------|
| 全量备份 | 每日 | 30 天 | 异地对象存储（S3） |
| WAL 归档 | 持续 | 7 天 | 异地对象存储（S3） |
| 异地全量 | 每周 | 90 天 | 跨 Region 存储 |

- 客户站点（Windows Worker）数据每日同步至云控制面，RPO ≤ 4h。
- 备份恢复演练每季度执行一次，验证 RTO ≤ 8h。
- 备份加密存储（AES-256），密钥与备份分离管理。

## 12. EXPLAIN ANALYZE

- 新查询上线前必须跑 `EXPLAIN ANALYZE` 验证执行计划。
- 禁止大表 `Seq Scan`（全表扫描）出现在生产查询中。
- 索引未命中的查询须优化或加索引后再上线。

```sql
-- 验证查询执行计划
EXPLAIN ANALYZE
SELECT * FROM projects
WHERE owner_id = 123 AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 20;

-- 期望：Index Scan using idx_projects_owner_status
-- 禁止：Seq Scan on projects（大表全表扫描）
```
