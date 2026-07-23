package com.platform.core.iam.domain;

/**
 * 数据分类等级枚举
 * 对应 PostgreSQL data_classification 类型，见 V1__init_iam.sql §3
 * 与 iam.contract.ts DataClassification 保持一致
 */
public enum DataClassification {

    /** 工作数据（开发/调试） */
    WORKING,
    /** 项目记录（业务过程数据） */
    PROJECT_RECORD,
    /** 已发布证据（审计/合规） */
    PUBLISHED_EVIDENCE,
    /** 敏感数据（PII L1，如密码哈希） */
    SENSITIVE,
    /** 运营遥测（指标/日志） */
    OPERATIONAL_TELEMETRY
}
