package com.platform.core.governance.domain.enums;

/**
 * 审计日志类别
 *
 * 用于 AuditLog 的分类标记，便于按类别检索与告警。
 * 与 BFF zod governanceAuditCategorySchema 对齐。
 */
public enum GovernanceAuditCategory {

    /** 认证类：登录、登出、token 刷新、密码修改 */
    AUTH,
    /** 数据类：CRUD、文件上传/下载、版本管理 */
    DATA,
    /** 治理类：访问授权、Release 发布、数据资产变更 */
    GOVERNANCE,
    /** AI 类：模型调用、生成记录、审签 */
    AI,
    /** 发布类：施工图发布、交付物发布 */
    PUBLICATION,
    /** 管理类：用户管理、租户配置、系统设置 */
    ADMIN
}
