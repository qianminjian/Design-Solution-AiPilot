-- V13__fix_design_feedback_classification.sql
-- 修复 design_feedback 表缺失 classification 列的问题
-- DesignFeedback 实体通过 @Enumerated(STRING) 声明 classification 字段

ALTER TABLE design_feedback
    ADD COLUMN IF NOT EXISTS classification VARCHAR(30) NOT NULL DEFAULT 'PROJECT_RECORD';

COMMENT ON COLUMN design_feedback.classification IS '数据分级：PROJECT_RECORD / SENSITIVE / CONFIDENTIAL';
