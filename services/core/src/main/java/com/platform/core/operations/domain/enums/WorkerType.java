package com.platform.core.operations.domain.enums;

/**
 * Worker 类型
 *
 * 与前端 WorkerType 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum WorkerType {
    /** AI Worker（处理 AI_GENERATION 任务） */
    AI,
    /** 规则 Worker（处理 COMPLIANCE_CHECK 任务） */
    RULE,
    /** 分析 Worker（处理 ANALYSIS_RUN 任务） */
    ANALYSIS,
    /** 文件 Worker（处理 INGEST_PARSE 任务） */
    INGEST,
    /** 发布 Worker（处理 PUBLICATION_SEAL 任务） */
    PUBLICATION
}
