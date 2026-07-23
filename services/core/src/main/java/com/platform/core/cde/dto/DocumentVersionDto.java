package com.platform.core.cde.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 文档版本响应 DTO（对齐 cde.contract.ts §DocumentVersionDto）
 *
 * @param id            版本 ID
 * @param documentId    所属文档 ID
 * @param versionNumber 版本号（同文档内单调递增）
 * @param uploadedBy    上传人
 * @param uploadedAt    上传时间
 * @param comment       版本说明
 * @param storageKey    对象存储 Key
 * @param checksum      版本内容校验和（SHA-256）
 * @param status        版本状态
 */
public record DocumentVersionDto(
        UUID id,
        UUID documentId,
        Integer versionNumber,
        UUID uploadedBy,
        Instant uploadedAt,
        String comment,
        String storageKey,
        String checksum,
        String status
) {
}
