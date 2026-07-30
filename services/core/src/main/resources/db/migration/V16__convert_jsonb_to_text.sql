-- V16__convert_jsonb_to_text.sql
-- 将所有业务表的 jsonb 列改为 text（解决 Hibernate 6 + PostgreSQL jsonb 类型转换错误）
-- Hibernate @Column(columnDefinition = "jsonb") 将 Java String 作为 VARCHAR 发送，PostgreSQL jsonb 不接受裸 VARCHAR
-- 改为 text 后 Hibernate 映射正常，数据无损

-- IAM
ALTER TABLE iam.principal ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE iam.organization ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE iam.membership ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE iam.role_binding ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE iam.access_grant ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE iam.tenant ALTER COLUMN settings TYPE TEXT USING settings::TEXT;

-- Portfolio
ALTER TABLE portfolio.project ALTER COLUMN settings TYPE TEXT USING settings::TEXT;
ALTER TABLE portfolio.project ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE portfolio.stage_instance ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE portfolio.gate_decision ALTER COLUMN evidence TYPE TEXT USING evidence::TEXT;
ALTER TABLE portfolio.gate_decision ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE portfolio.project_baseline ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;

-- Workflow
ALTER TABLE workflow.instance ALTER COLUMN context TYPE TEXT USING context::TEXT;
ALTER TABLE workflow.instance ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE workflow.task ALTER COLUMN task_data TYPE TEXT USING task_data::TEXT;
ALTER TABLE workflow.task ALTER COLUMN form_data TYPE TEXT USING form_data::TEXT;
ALTER TABLE workflow.task ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE workflow.attempt ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE workflow.timer ALTER COLUMN payload TYPE TEXT USING payload::TEXT;
ALTER TABLE workflow.timer ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE workflow.definition_revision ALTER COLUMN definition TYPE TEXT USING definition::TEXT;
ALTER TABLE workflow.definition_revision ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;

-- Compliance
ALTER TABLE compliance.compliance_rules ALTER COLUMN basis TYPE TEXT USING basis::TEXT;
ALTER TABLE compliance.rule_revisions ALTER COLUMN dsl_json TYPE TEXT USING dsl_json::TEXT;
ALTER TABLE compliance.rule_revisions ALTER COLUMN parameters_json TYPE TEXT USING parameters_json::TEXT;
ALTER TABLE compliance.rule_revisions ALTER COLUMN basis TYPE TEXT USING basis::TEXT;
ALTER TABLE compliance.compliance_check_runs ALTER COLUMN outcome_summary TYPE TEXT USING outcome_summary::TEXT;
ALTER TABLE compliance.check_results ALTER COLUMN evidence_json TYPE TEXT USING evidence_json::TEXT;

-- CDE
ALTER TABLE cde.asset ALTER COLUMN extensions TYPE TEXT USING extensions::TEXT;
ALTER TABLE cde.asset ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.asset_version ALTER COLUMN extensions TYPE TEXT USING extensions::TEXT;
ALTER TABLE cde.asset_version ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.object_manifest ALTER COLUMN scan_result TYPE TEXT USING scan_result::TEXT;
ALTER TABLE cde.object_manifest ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.rendition ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.baseline_item ALTER COLUMN snapshot TYPE TEXT USING snapshot::TEXT;
ALTER TABLE cde.baseline_item ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.transmittal ALTER COLUMN items TYPE TEXT USING items::TEXT;
ALTER TABLE cde.transmittal ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.document ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE cde.document_version ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;

-- AI
ALTER TABLE ai.capability_revision ALTER COLUMN default_params TYPE TEXT USING default_params::TEXT;
ALTER TABLE ai.capability_revision ALTER COLUMN guardrail_config TYPE TEXT USING guardrail_config::TEXT;
ALTER TABLE ai.capability_revision ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE ai.run ALTER COLUMN input_manifest TYPE TEXT USING input_manifest::TEXT;
ALTER TABLE ai.run ALTER COLUMN output_manifest TYPE TEXT USING output_manifest::TEXT;
ALTER TABLE ai.run ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE ai.tool_call ALTER COLUMN arguments TYPE TEXT USING arguments::TEXT;
ALTER TABLE ai.tool_call ALTER COLUMN result TYPE TEXT USING result::TEXT;
ALTER TABLE ai.tool_call ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE ai.guardrail_result ALTER COLUMN findings TYPE TEXT USING findings::TEXT;
ALTER TABLE ai.guardrail_result ALTER COLUMN details TYPE TEXT USING details::TEXT;
ALTER TABLE ai.guardrail_result ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;

-- Platform
ALTER TABLE platform.outbox_event ALTER COLUMN payload TYPE TEXT USING payload::TEXT;
ALTER TABLE platform.saga_instance ALTER COLUMN completed_steps TYPE TEXT USING completed_steps::TEXT;
ALTER TABLE platform.saga_instance ALTER COLUMN context_payload TYPE TEXT USING context_payload::TEXT;
ALTER TABLE platform.saga_instance ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;

-- Public (TEVV & Design & AI Generation Records)
ALTER TABLE public.verification_item ALTER COLUMN evidence_refs TYPE TEXT USING evidence_refs::TEXT;
ALTER TABLE public.verification_execution ALTER COLUMN output TYPE TEXT USING output::TEXT;
ALTER TABLE public.design_option ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE public.ai_generation_record ALTER COLUMN variables TYPE TEXT USING variables::TEXT;
ALTER TABLE public.ai_generation_record ALTER COLUMN candidates TYPE TEXT USING candidates::TEXT;
ALTER TABLE public.ai_generation_record ALTER COLUMN token_usage TYPE TEXT USING token_usage::TEXT;
ALTER TABLE public.ai_generation_record ALTER COLUMN guardrail_result TYPE TEXT USING guardrail_result::TEXT;
ALTER TABLE public.ai_generation_record ALTER COLUMN review_decision TYPE TEXT USING review_decision::TEXT;

-- Requirement
ALTER TABLE requirement.source ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE requirement.requirement_revision ALTER COLUMN extensions TYPE TEXT USING extensions::TEXT;
ALTER TABLE requirement.requirement_revision ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
ALTER TABLE requirement.trace_link ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
