package com.platform.core.analysis.domain.enums;

/**
 * 结果质量状态（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * PENDING → VALID / QUESTIONABLE / INVALID
 * VALID / QUESTIONABLE → SUPERSEDED（被新结果取代）
 *
 * 安全红线：
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *  - 决策 ACCEPT_AS_REVISION / EXCEPTION 需注册师签章
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum ResultQualityStatus {
    /** 待审查 */
    PENDING,
    /** 有效 */
    VALID,
    /** 可疑（需复核） */
    QUESTIONABLE,
    /** 无效 */
    INVALID,
    /** 已被新结果取代 */
    SUPERSEDED
}
