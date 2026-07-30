package com.platform.core.operations.domain.enums;

/**
 * 连接器类型
 *
 * 与前端 ConnectorType 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 * 对齐 OD-05 外部 AI 接入约束与 OD-04 工具版本基线。
 */
public enum ConnectorType {
    /** LLM API（通用大语言模型） */
    LLM,
    /** 建筑 AI Provider（EVAI/小库 AI/建筑学长，V1 维持 ManualHandoff） */
    AI_PROVIDER,
    /** 对象存储（MinIO/S3） */
    MINIO,
    /** Revit Worker 连接器（2022/2024） */
    REVIT,
    /** Rhino Worker 连接器（7/8） */
    RHINO,
    /** SketchUp Worker 连接器（2023/2024 Pro） */
    SKETCHUP
}
