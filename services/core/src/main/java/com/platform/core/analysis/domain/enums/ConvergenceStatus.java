package com.platform.core.analysis.domain.enums;

/**
 * 收敛状态（D37.14 P10 工程分析运行与结果质量）
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum ConvergenceStatus {
    /** 已收敛 */
    CONVERGED,
    /** 已发散 */
    DIVERGED,
    /** 进行中 */
    IN_PROGRESS,
    /** 未开始 */
    NOT_STARTED
}
