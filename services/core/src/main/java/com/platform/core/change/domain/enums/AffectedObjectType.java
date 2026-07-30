package com.platform.core.change.domain.enums;

/**
 * 受影响对象类型
 *
 * 与前端 AffectedObjectType 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum AffectedObjectType {
    /** 需求 */
    REQUIREMENT,
    /** 设计候选 */
    DESIGN_OPTION,
    /** 图纸/文档 */
    DRAWING,
    /** BIM 模型 */
    MODEL,
    /** 分析问题 */
    ANALYSIS_PROBLEM,
    /** 分析场景 */
    ANALYSIS_SCENARIO,
    /** 分析结果 */
    ANALYSIS_RESULT,
    /** 合规规则 */
    COMPLIANCE_RULE,
    /** 检查运行 */
    CHECK_RUN,
    /** 发现项 */
    FINDING,
    /** 发布包 */
    PUBLICATION,
    /** 其他 */
    OTHER
}
