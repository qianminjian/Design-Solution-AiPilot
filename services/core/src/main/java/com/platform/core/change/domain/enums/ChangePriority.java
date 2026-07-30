package com.platform.core.change.domain.enums;

/**
 * 变更优先级
 *
 * 与前端 ChangePriority 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 * 高风险（CRITICAL）变更需 stepUpToken 二次认证。
 */
public enum ChangePriority {
    /** 低（无 SLA 影响） */
    LOW,
    /** 普通 */
    NORMAL,
    /** 主要（影响交付物） */
    MAJOR,
    /** 关键（影响项目交付/合规/安全） */
    CRITICAL
}
