package com.platform.core.operations.domain.enums;

/**
 * SLO 健康状态
 *
 * 与前端 SloStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum SloStatus {
    /** 健康（可用率达标，错误预算充足） */
    HEALTHY,
    /** 警告（错误预算消耗过快，需关注） */
    WARNING,
    /** 严重（已突破错误预算，需立即处置） */
    CRITICAL
}
