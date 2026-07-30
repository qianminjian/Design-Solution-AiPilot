-- V15__fix_iam_classification_varchar.sql
-- 将 IAM 表的 classification 列从 PostgreSQL 自定义枚举类型 data_classification 改为 VARCHAR(30)
-- 原因：Hibernate @Enumerated(EnumType.STRING) 发送 VARCHAR 值到服务器，但 PostgreSQL 自定义枚举类型不接受裸 VARCHAR
-- 此迁移与 V13__fix_design_feedback_classification.sql 策略一致

-- 1. Tenant
ALTER TABLE iam.tenant
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'PROJECT_RECORD';

-- 2. Principal
ALTER TABLE iam.principal
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'SENSITIVE';

-- 3. Membership
ALTER TABLE iam.membership
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'PROJECT_RECORD';

-- 4. Organization
ALTER TABLE iam.organization
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'PROJECT_RECORD';

-- 5. AccessGrant
ALTER TABLE iam.access_grant
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'PROJECT_RECORD';

-- 6. RoleBinding
ALTER TABLE iam.role_binding
    ALTER COLUMN classification TYPE VARCHAR(30) USING classification::VARCHAR(30),
    ALTER COLUMN classification SET NOT NULL,
    ALTER COLUMN classification SET DEFAULT 'PROJECT_RECORD';
