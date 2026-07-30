package com.platform.core.change.domain.enums;

/**
 * 受影响对象动作
 *
 * 与前端 AffectedAction 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum AffectedAction {
    /** 新增 */
    ADDED,
    /** 修改 */
    MODIFIED,
    /** 删除 */
    REMOVED,
    /** 替换 */
    REPLACED,
    /** 暂停（待评估） */
    SUSPENDED
}
