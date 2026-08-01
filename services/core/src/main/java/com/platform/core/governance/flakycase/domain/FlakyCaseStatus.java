package com.platform.core.governance.flakycase.domain;

/**
 * Flaky Case 状态（D45.22 缺陷、Flaky 与例外治理，SIT P0-13.2）
 *
 * 状态机：
 *  - TRACKED 跟踪中（未检测到连续不稳定）
 *  - FLAKY 连续重复不稳定即隔离（连续 3 次结果翻转或达到不稳定阈值）
 *  - ISOLATED 已隔离（对应 Requirement 变 Coverage Gap）
 *  - RESOLVED 已修复（根因分类 + 最小回归样本）
 */
public enum FlakyCaseStatus {
    /** 跟踪中（运行稳定或未达阈值） */
    TRACKED,
    /** 连续重复不稳定（待隔离） */
    FLAKY,
    /** 已隔离（对应 Requirement 变 Coverage Gap） */
    ISOLATED,
    /** 已修复（根因分类 + 最小回归样本） */
    RESOLVED,
}
