-- R3 GoldenDataset 与 VerificationItem 数据模型
-- 支撑 D45 TEVV（测试评估验证确认）和 Gate 准入证据

-- 金样数据集：存储建筑专业验证数据集的元数据
CREATE TABLE golden_dataset (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    -- 数据集分类：ARCHITECTURE/STRUCTURE/MEP/COORDINATION
    category        VARCHAR(50) NOT NULL,
    -- 建筑类型：OFFICE_SMALL / OFFICE_MEDIUM / OFFICE_LARGE
    building_type   VARCHAR(50) NOT NULL,
    -- 数据集状态：DRAFT / FROZEN / DEPRECATED
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- 版本号（语义化版本）
    version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    -- 存储键（MinIO/S3 对象键前缀）
    storage_key     VARCHAR(500) NOT NULL,
    -- 文件数量
    file_count      INTEGER NOT NULL DEFAULT 0,
    -- 总大小（字节）
    total_size_bytes BIGINT NOT NULL DEFAULT 0,
    -- 冻结时间（status 变为 FROZEN 时记录）
    frozen_at       TIMESTAMPTZ,
    -- 冻结操作人
    frozen_by       UUID,
    -- 审计字段
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL
);

CREATE INDEX idx_golden_dataset_tenant ON golden_dataset(tenant_id);
CREATE INDEX idx_golden_dataset_status ON golden_dataset(status);
CREATE UNIQUE INDEX uk_golden_dataset_name_version ON golden_dataset(tenant_id, name, version);

-- 验证项：定义每个 Gate 准入需要验证的具体条目
CREATE TABLE verification_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    -- 关联金样数据集
    dataset_id      UUID NOT NULL REFERENCES golden_dataset(id),
    -- 验证项编号（如 G1-01、G3-05）
    item_code       VARCHAR(20) NOT NULL,
    -- 验证项标题
    title           VARCHAR(200) NOT NULL,
    -- 详细描述
    description     TEXT,
    -- 关联 Gate 编号（1-6，对应 Pre-Implementation Gate）
    gate_number     SMALLINT NOT NULL CHECK (gate_number BETWEEN 1 AND 6),
    -- 验证类型：MANUAL / AUTOMATED / SEMI_AUTOMATED
    verification_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    -- 风险等级：LOW / MEDIUM / HIGH / CRITICAL
    risk_level      VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    -- 验证状态：PENDING / IN_PROGRESS / PASSED / FAILED / WAIVED
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- 证据文档引用（JSON 数组，存储 MinIO 对象键）
    evidence_refs   JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 验证人
    verified_by     UUID,
    -- 验证时间
    verified_at     TIMESTAMPTZ,
    -- 豁免原因（status 为 WAIVED 时必填）
    waiver_reason   TEXT,
    -- 审计字段
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL
);

CREATE INDEX idx_verification_item_dataset ON verification_item(dataset_id);
CREATE INDEX idx_verification_item_gate ON verification_item(gate_number);
CREATE INDEX idx_verification_item_status ON verification_item(status);
CREATE UNIQUE INDEX uk_verification_item_code ON verification_item(tenant_id, dataset_id, item_code);

-- 验证执行记录：记录每次验证执行的详细结果
CREATE TABLE verification_execution (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    -- 关联验证项
    item_id         UUID NOT NULL REFERENCES verification_item(id),
    -- 执行触发方式：SCHEDULED / MANUAL / CI_PIPELINE
    trigger_type    VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    -- 执行结果：PASSED / FAILED / ERROR / SKIPPED
    result          VARCHAR(20) NOT NULL,
    -- 详细输出（JSON，包含断言结果、错误信息等）
    output          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- 执行耗时（毫秒）
    duration_ms     INTEGER,
    -- 执行人/触发者
    executed_by     UUID,
    -- CI 流水线 ID（trigger_type 为 CI_PIPELINE 时）
    pipeline_id     VARCHAR(100),
    -- 审计字段
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_execution_item ON verification_execution(item_id);
CREATE INDEX idx_verification_execution_result ON verification_execution(result);
