package com.platform.core.change.domain.enums;

/**
 * 影响等级
 *
 * 与前端 ImpactLevel 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 * Unknown 影响项阻断关闭，必须先解决。
 */
public enum ImpactLevel {
    /** 已确认影响（必须处置） */
    CONFIRMED,
    /** 潜在影响（需进一步评估） */
    POTENTIAL,
    /** 未知影响（阻断关闭，必须先解决） */
    UNKNOWN,
    /** 无影响（已确认不影响） */
    NO_IMPACT
}
