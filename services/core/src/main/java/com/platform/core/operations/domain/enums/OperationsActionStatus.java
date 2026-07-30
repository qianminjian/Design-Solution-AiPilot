package com.platform.core.operations.domain.enums;

/**
 * Operations 主动作执行状态
 *
 * 与前端 OperationsActionResponseDto.status 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum OperationsActionStatus {
    /** 已入队（异步执行，等待 Worker 拉取） */
    QUEUED,
    /** 执行中（Worker 正在处理） */
    RUNNING,
    /** 已完成（终态） */
    COMPLETED,
    /** 已失败（终态，需人工介入） */
    FAILED
}
