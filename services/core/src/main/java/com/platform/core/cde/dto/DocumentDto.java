package com.platform.core.cde.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 文档响应 DTO（对齐 cde.contract.ts §DocumentDto）
 *
 * @param id                文档 ID
 * @param tenantId          租户 ID
 * @param projectId         所属项目 ID
 * @param name              文档名称
 * @param path              文档路径（PII: L5）
 * @param mimeType          MIME 类型
 * @param sizeBytes         文件大小（字节）
 * @param currentVersionId  当前版本 ID
 * @param status            文档状态
 * @param checksum          当前版本内容校验和
 * @param createdBy         创建人
 * @param createdAt         创建时间
 * @param updatedAt         更新时间
 * @param version           乐观锁版本号
 */
public record DocumentDto(
        UUID id,
        UUID tenantId,
        UUID projectId,
        String name,
        String path,
        String mimeType,
        Long sizeBytes,
        UUID currentVersionId,
        String status,
        String checksum,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        Long version
) {
}
