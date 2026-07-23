package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 主体响应 DTO（不暴露 passwordHash，见 iam.contract.ts §PrincipalDto）
 *
 * @param id              主体 ID
 * @param tenantId        租户 ID
 * @param type            主体类型（USER/SERVICE/AGENT/DEVICE/EXTERNAL）
 * @param email           邮箱
 * @param displayName     显示名
 * @param status          状态
 * @param locale          语言
 * @param timezone        时区
 * @param classification  数据分类
 * @param externalId      外部 ID
 * @param lastLoginAt     最后登录时间
 * @param createdAt       创建时间
 * @param updatedAt       更新时间
 * @param rowVersion      行版本号
 */
public record PrincipalDto(
        UUID id,
        UUID tenantId,
        String type,
        String email,
        String displayName,
        String status,
        String locale,
        String timezone,
        String classification,
        String externalId,
        Instant lastLoginAt,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
