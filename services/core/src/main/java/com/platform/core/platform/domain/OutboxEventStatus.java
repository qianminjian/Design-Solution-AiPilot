package com.platform.core.platform.domain;

/**
 * Outbox 事件状态枚举
 *
 * <p>对应数据库列 {@code platform.outbox_event.status}（V4 SQL 注释：PENDING/PUBLISHED/FAILED/DEAD_LETTER）
 *
 * <p>状态机：
 * <pre>
 *   PENDING ──publish ok──→ PUBLISHED
 *   PENDING ──fail──→ FAILED ──retry──→ PENDING
 *   FAILED ──max attempts──→ DEAD_LETTER
 * </pre>
 */
public enum OutboxEventStatus {
    /** 待发布（初始状态） */
    PENDING,
    /** 已发布（终态） */
    PUBLISHED,
    /** 发布失败（可重试） */
    FAILED,
    /** 死信（重试次数超限，需人工介入） */
    DEAD_LETTER
}
