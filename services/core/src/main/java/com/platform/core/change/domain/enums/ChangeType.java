package com.platform.core.change.domain.enums;

/**
 * 变更类型
 *
 * 与前端 ChangeType 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum ChangeType {
    /** 需求变更（来源/范围/口径变化） */
    REQUIREMENT_CHANGE,
    /** 设计变更（方案/图纸/BIM 模型变化） */
    DESIGN_CHANGE,
    /** 规则变更（合规规则/规范引用变化） */
    RULE_CHANGE,
    /** 模型变更（BIM 模型属性/参数变化） */
    MODEL_CHANGE,
    /** 图纸变更（2D 图纸版本/标注变化） */
    DRAWING_CHANGE,
    /** 分析变更（分析输入/边界条件/求解器变化） */
    ANALYSIS_CHANGE,
    /** 其他 */
    OTHER
}
