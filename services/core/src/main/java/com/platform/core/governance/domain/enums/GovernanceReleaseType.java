package com.platform.core.governance.domain.enums;

/**
 * 治理域 Release 类型
 *
 * 用于 Release 实体标识发布对象的类型。
 * 与 BFF zod governanceReleaseTypeSchema 对齐。
 */
public enum GovernanceReleaseType {

    /** LLM 模型发布（如 GPT-4 / Claude 等） */
    LLM,
    /** 规则集发布（如 IDS 规则集 / 合规规则集） */
    RULE_SET,
    /** AI Provider 接入发布（如 EVAI / 小库 AI 等） */
    AI_PROVIDER
}
