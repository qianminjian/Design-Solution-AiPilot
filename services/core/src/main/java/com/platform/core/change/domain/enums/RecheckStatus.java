package com.platform.core.change.domain.enums;

/**
 * 需复查状态
 *
 * 与前端 RecheckStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum RecheckStatus {
    /** 不需要复查 */
    NOT_REQUIRED,
    /** 待复查 */
    PENDING,
    /** 复查中 */
    IN_PROGRESS,
    /** 复查通过 */
    PASSED,
    /** 复查未通过 */
    FAILED,
    /** 已豁免（带审批记录） */
    WAIVED
}
