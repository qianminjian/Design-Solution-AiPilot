-- V5__init_cde_document.sql
-- cde 领域 - 文档/版本/检入检出管理（V1 简化模型）
-- 与 V3 中的 cde.asset 完整资产模型解耦，聚焦文档元数据 + 版本 + 状态流转
-- PII 分级：文档路径为 L5（业务核心设计文件），见 security.md §8

-- ============================================================
-- 1. cde.document - 文档（聚合根）
-- ============================================================
CREATE TABLE cde.document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    -- 文档路径（PII: L5 业务核心设计文件），脱敏见 security.md §3
    path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    current_version_id UUID,
    -- 文档状态：DRAFT / CHECKED_OUT / PUBLISHED / SUPERSEDED / ARCHIVED
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- 内容校验和（SHA-256），用于版本去重与完整性校验
    checksum VARCHAR(64),
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_document_tenant_project
    ON cde.document(tenant_id, project_id, updated_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_document_status
    ON cde.document(tenant_id, project_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_document_path
    ON cde.document(tenant_id, project_id, path)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE cde.document IS '文档表（V1 简化 CDE 聚合根，对应任务 Document 实体）';
COMMENT ON COLUMN cde.document.path IS '文档路径（PII: L5 业务核心设计文件）';
COMMENT ON COLUMN cde.document.status IS 'DRAFT/CHECKED_OUT/PUBLISHED/SUPERSEDED/ARCHIVED';
COMMENT ON COLUMN cde.document.checksum IS '当前版本内容 SHA-256 哈希';

-- ============================================================
-- 2. cde.document_version - 文档版本（不可变修订）
-- ============================================================
CREATE TABLE cde.document_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES cde.document(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    uploaded_by UUID REFERENCES iam.principal(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    comment TEXT,
    -- 对象存储 Key（S3/MinIO），仅存储引用，本任务不实际上传
    storage_key VARCHAR(1000) NOT NULL,
    -- 版本内容校验和（SHA-256）
    checksum VARCHAR(64) NOT NULL,
    -- 版本状态：DRAFT / PUBLISHED / SUPERSEDED
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(200),
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

-- 同文档内 version_number 唯一
CREATE UNIQUE INDEX idx_document_version_number
    ON cde.document_version(document_id, version_number);
CREATE INDEX idx_document_version_document
    ON cde.document_version(document_id, version_number DESC);
CREATE INDEX idx_document_version_status
    ON cde.document_version(document_id, status);
CREATE INDEX idx_document_version_tenant_project
    ON cde.document_version(tenant_id, project_id, uploaded_at DESC);

COMMENT ON TABLE cde.document_version IS '文档版本表（不可变修订模型）';
COMMENT ON COLUMN cde.document_version.storage_key IS '对象存储 Key（S3/MinIO），格式：tenant/project/document_id/version_id';
COMMENT ON COLUMN cde.document_version.checksum IS '版本内容 SHA-256 哈希（不可变）';
COMMENT ON COLUMN cde.document_version.version_number IS '版本号，同文档内单调递增';

-- ============================================================
-- 3. 为新增表创建 updated_at 触发器
-- ============================================================
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'cde'
          AND table_name IN ('document', 'document_version')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON cde.%I', t);
        EXECUTE format('CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON cde.%I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', t);
    END LOOP;
END $$;
