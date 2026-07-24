-- AI 生成记录表：记录每次 AI 方案生成的完整上下文，支撑审计追溯
-- 与 design_option 通过 design_option_id 关联（可选，接受为设计选项时回填）

CREATE TABLE ai_generation_record (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    project_id              UUID NOT NULL,
    -- 关联设计选项（接受候选后回填）
    design_option_id        UUID,
    -- 输入：Prompt 模板与变量
    prompt_template         VARCHAR(128) NOT NULL,
    variables               JSONB,
    rendered_prompt         TEXT NOT NULL,
    -- 输出：原始内容与解析候选
    raw_content             TEXT NOT NULL,
    candidates              JSONB NOT NULL,
    -- 模型与用量
    model                   VARCHAR(64) NOT NULL,
    token_usage             JSONB NOT NULL,
    -- 风险与 Guardrails
    risk_level              VARCHAR(16) NOT NULL,
    guardrail_result        JSONB NOT NULL,
    requires_human_review   BOOLEAN NOT NULL DEFAULT TRUE,
    latency_ms              INTEGER NOT NULL DEFAULT 0,
    -- 全链路追踪 ID
    trace_id                VARCHAR(64),
    -- 审计字段
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by              UUID,
    row_version             BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_ai_gen_record_tenant ON ai_generation_record(tenant_id);
CREATE INDEX idx_ai_gen_record_project ON ai_generation_record(project_id);
CREATE INDEX idx_ai_gen_record_design_option ON ai_generation_record(design_option_id);
CREATE INDEX idx_ai_gen_record_trace ON ai_generation_record(trace_id);
CREATE INDEX idx_ai_gen_record_created_at ON ai_generation_record(created_at DESC);
