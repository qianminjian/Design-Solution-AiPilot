package com.platform.core.analysis.domain.enums;

/**
 * 工程分析问题状态（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * DRAFT → READY → RUNNING → COMPLETED → REVIEWED
 *      ↓ (任意阶段) → INVALID（输入过期 / Baseline 变化）
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum ProblemStatus {
    /** 草稿（输入未完成） */
    DRAFT,
    /** 就绪（可运行） */
    READY,
    /** 运行中 */
    RUNNING,
    /** 已完成（结果待审查） */
    COMPLETED,
    /** 已审查 */
    REVIEWED,
    /** 失效（输入过期 / Baseline 变化） */
    INVALID
}
