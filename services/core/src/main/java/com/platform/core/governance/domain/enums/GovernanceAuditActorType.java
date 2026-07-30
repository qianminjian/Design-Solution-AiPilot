package com.platform.core.governance.domain.enums;

/**
 * 审计执行者类型
 *
 * 用于标识审计日志的 actor 类型，便于追溯操作来源。
 * 与 BFF zod governanceAuditActorTypeSchema 对齐。
 */
public enum GovernanceAuditActorType {

    /** 真实用户（通过登录态操作） */
    USER,
    /** 后台服务（通过 service account 操作） */
    SERVICE,
    /** AI 智能体（通过 LLM/Agent 调用） */
    AI,
    /** 系统定时任务或事件触发 */
    SYSTEM
}
