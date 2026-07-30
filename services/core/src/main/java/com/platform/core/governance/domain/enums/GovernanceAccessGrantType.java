package com.platform.core.governance.domain.enums;

/**
 * 治理域访问授权类型
 *
 * 用于 AccessGrant 实体标识授权对象的类型。
 * 与 BFF zod governanceAccessGrantTypeSchema 对齐。
 */
public enum GovernanceAccessGrantType {

    /** 内部成员（普通用户授权） */
    MEMBER,
    /** 外部协作者（如顾问、合作方） */
    EXTERNAL,
    /** 服务账号（系统间调用授权） */
    SERVICE,
    /** 紧急破窗（break-glass 高风险授权） */
    BREAKGLASS
}
