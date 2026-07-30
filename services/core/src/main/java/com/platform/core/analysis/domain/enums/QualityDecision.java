package com.platform.core.analysis.domain.enums;

/**
 * 质量评估决策（D37.14 P10 工程分析运行与结果质量）
 *
 * 安全红线：
 *  - ACCEPT_AS_REVISION / EXCEPTION 需注册师签章
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum QualityDecision {
    /** 接受为草稿 */
    ACCEPT_AS_DRAFT,
    /** 接受为修订（需注册师签章） */
    ACCEPT_AS_REVISION,
    /** 拒绝 */
    REJECT,
    /** 上报 */
    ESCALATE,
    /** 例外批准（需注册师签章） */
    EXCEPTION,
    /** 需要更多信息（V20 SQL 对齐） */
    NEEDS_MORE_INFO
}
