package com.platform.core.cde.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 检出响应 DTO（对齐 cde.contract.ts §CheckoutDto）
 *
 * @param documentId    文档 ID
 * @param status        文档状态（CHECKED_OUT）
 * @param checkedOutBy  检出执行人
 * @param checkedOutAt  检出时间
 */
public record CheckoutDto(
        UUID documentId,
        String status,
        UUID checkedOutBy,
        Instant checkedOutAt
) {
}
