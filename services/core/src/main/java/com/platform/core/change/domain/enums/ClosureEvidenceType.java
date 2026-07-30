package com.platform.core.change.domain.enums;

/**
 * 关闭证据类型
 *
 * 与前端 ClosureEvidenceType 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum ClosureEvidenceType {
    /** 设计评审记录 */
    DESIGN_REVIEW,
    /** 规则运行结果 */
    RULE_RUN,
    /** AI 复核结果 */
    AI_REVIEW,
    /** 人工签章 */
    SIGNATURE,
    /** 测试报告 */
    TEST_REPORT,
    /** 验证记录 */
    VERIFICATION,
    /** 其他 */
    OTHER
}
