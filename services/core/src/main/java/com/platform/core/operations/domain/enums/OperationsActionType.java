package com.platform.core.operations.domain.enums;

/**
 * Operations 主动作类型（D37.17 §危险动作）
 *
 * 与前端 OperationsActionType 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 *
 * 风险等级映射（D37.23 §危险动作）：
 *  - ISOLATE: HIGH（需 stepUpToken + 影响预览确认）
 *  - RETRY: MEDIUM（需影响预览确认）
 *  - RECONCILE: MEDIUM（需影响预览确认）
 *  - FAILOVER: HIGH（需 stepUpToken + 影响预览确认）
 *  - PAUSE: MEDIUM（需影响预览确认）
 *  - RESUME: LOW
 *  - CANCEL: IRREVERSIBLE（需 stepUpToken + 影响预览确认 + 双人审批）
 *  - DELETE: IRREVERSIBLE（V1.10 新增，删除资源不可恢复，需双人审批）
 */
public enum OperationsActionType {
    /** 隔离（将 Worker/Connector 从调度池移除，HIGH 风险） */
    ISOLATE,
    /** 重试（重新入队失败任务，MEDIUM 风险） */
    RETRY,
    /** 对账（核对状态一致性，MEDIUM 风险） */
    RECONCILE,
    /** 故障转移（切换到备用实例，HIGH 风险） */
    FAILOVER,
    /** 暂停（暂停队列任务或 Worker，MEDIUM 风险） */
    PAUSE,
    /** 恢复（恢复暂停的队列任务或 Worker，LOW 风险） */
    RESUME,
    /** 取消（终止任务，IRREVERSIBLE 不可逆） */
    CANCEL,
    /** 删除（硬删除 Worker/Connector 资源，IRREVERSIBLE 不可逆，V1.10 新增） */
    DELETE
}
