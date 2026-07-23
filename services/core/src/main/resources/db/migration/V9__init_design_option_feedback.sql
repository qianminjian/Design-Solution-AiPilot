-- R4 Design 设计选项与反馈数据模型
-- 支撑方案候选轮管理、设计评审与反馈收集

-- 设计选项：项目下的方案候选
CREATE TABLE design_option (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    project_id          UUID NOT NULL,
    title               VARCHAR(256) NOT NULL,
    description         TEXT,
    -- 状态：DRAFT / CANDIDATE / SUBMITTED / ACCEPTED / RETURNED / ARCHIVED
    status              VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    -- 专业：ARCHITECTURE / STRUCTURE / MEP / LANDSCAPE / INTERIOR
    discipline          VARCHAR(30) NOT NULL DEFAULT 'ARCHITECTURE',
    -- 元数据（JSONB）：方案参数、指标、标签等
    metadata            JSONB,
    -- 数据分级：PROJECT_RECORD / SENSITIVE / CONFIDENTIAL
    classification      VARCHAR(30) NOT NULL DEFAULT 'PROJECT_RECORD',
    -- 缩略图文档 ID
    thumbnail_document_id UUID,
    -- 审计字段
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          UUID,
    row_version         BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_design_option_tenant ON design_option(tenant_id);
CREATE INDEX idx_design_option_project ON design_option(project_id);
CREATE INDEX idx_design_option_status ON design_option(status);
CREATE INDEX idx_design_option_discipline ON design_option(discipline);

-- 设计反馈：对单个设计选项的评审意见
CREATE TABLE design_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    option_id       UUID NOT NULL REFERENCES design_option(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL,
    comment         TEXT NOT NULL,
    -- 评分：1-5 星，可选
    rating          INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    -- 审计字段
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID,
    row_version     BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_design_feedback_tenant ON design_feedback(tenant_id);
CREATE INDEX idx_design_feedback_option ON design_feedback(option_id);
CREATE INDEX idx_design_feedback_author ON design_feedback(author_id);
