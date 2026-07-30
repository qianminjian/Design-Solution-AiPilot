package com.platform.core.analysis.domain.enums;

/**
 * 工程分析问题类型（D37.14 P10 工程分析运行与结果质量）
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum AnalysisProblemType {
    /** 结构分析（抗震 / 挠度 / 承载力） */
    STRUCTURAL,
    /** 风工程（风荷载 / 风环境） */
    WIND,
    /** 热工（传热 / 结露） */
    THERMAL,
    /** 能耗（能耗模拟 / 碳排放） */
    ENERGY,
    /** 光环境（采光 / 眩光） */
    LIGHTING,
    /** 声环境（隔声 / 混响） */
    ACOUSTIC,
    /** 日照分析 */
    DAYLIGHT,
    /** 消防（烟气模拟 / 疏散） */
    FIRE,
    /** 岩土（沉降 / 承载） */
    GEOTECHNICAL,
    /** 其他 */
    OTHER
}
