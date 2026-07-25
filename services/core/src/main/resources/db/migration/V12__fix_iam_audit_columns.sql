-- V12__fix_iam_audit_columns.sql
-- 修复 iam.role_binding 和 iam.access_grant 缺失 created_by / updated_by 列的问题
-- BaseEntity 通过 @CreatedBy / @LastModifiedBy 期望所有表都包含这两列

-- 1. role_binding 添加审计列
ALTER TABLE iam.role_binding
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

COMMENT ON COLUMN iam.role_binding.created_by IS '创建人（审计）';
COMMENT ON COLUMN iam.role_binding.updated_by IS '最近更新人（审计）';

-- 2. access_grant 添加审计列
ALTER TABLE iam.access_grant
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

COMMENT ON COLUMN iam.access_grant.created_by IS '创建人（审计）';
COMMENT ON COLUMN iam.access_grant.updated_by IS '最近更新人（审计）';
