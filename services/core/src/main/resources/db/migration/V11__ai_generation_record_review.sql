-- AI 生成记录人工复核字段：支撑 AI 安全红线闭环
-- 当 requires_human_review=true 时，须通过人工复核决策（APPROVED/REJECTED/RETURNED）
-- 风险等级 high/critical 须双人复核 + 注册师签章（security.md §12）

ALTER TABLE ai_generation_record
    ADD COLUMN review_status     VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN reviewer_id       UUID,
    ADD COLUMN review_comment    TEXT,
    ADD COLUMN reviewed_at       TIMESTAMPTZ,
    ADD COLUMN review_decision   JSONB;

CREATE INDEX idx_ai_gen_record_review_status ON ai_generation_record(review_status)
    WHERE review_status = 'PENDING';
