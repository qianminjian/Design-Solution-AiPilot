package com.platform.core.operations.domain.enums;

/**
 * 队列任务类型
 *
 * 与前端 QueueTaskType 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum QueueTaskType {
    /** AI 生成任务（LLM/扩散模型调用） */
    AI_GENERATION,
    /** 合规检查任务（规则引擎执行） */
    COMPLIANCE_CHECK,
    /** 工程分析任务（结构/能耗/日照等） */
    ANALYSIS_RUN,
    /** 发布封存任务（签章 + 对象锁定） */
    PUBLICATION_SEAL,
    /** 文件解析任务（CAD/BIM 文件入库解析） */
    INGEST_PARSE,
    /** 清理任务（过期数据/临时文件清理） */
    CLEANUP
}
