package com.platform.core.platform.domain;

/**
 * Saga 实例状态枚举
 *
 * <p>权威源：@design/D34-数据-数据库.md §3 与 V0 裁剪表
 * （workflow schema 的 compensation/saga 在 V1 完整实现，V0 仅提供状态机骨架）
 *
 * <p>状态机：
 * <pre>
 *   STARTED ──step ok──→ COMPLETED
 *   STARTED ──step fail──→ COMPENSATING ──ok──→ COMPENSATED
 *   COMPENSATING ──fail──→ FAILED
 *   STARTED ──timeout/abort──→ ABORTED
 * </pre>
 */
public enum SagaStatus {
    /** 已启动（初始状态） */
    STARTED,
    /** 已完成（终态，所有步骤成功） */
    COMPLETED,
    /** 补偿中（某步骤失败，回滚已执行步骤） */
    COMPENSATING,
    /** 已补偿（终态，补偿成功） */
    COMPENSATED,
    /** 失败（终态，补偿失败需人工介入） */
    FAILED,
    /** 已中止（终态，业务主动取消） */
    ABORTED
}
