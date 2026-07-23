package com.platform.core.design.dto;

import com.platform.core.design.domain.DesignDiscipline;
import com.platform.core.design.domain.DesignOptionStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 设计选项 DTO
 */
public record DesignOptionDto(
    UUID id,
    UUID tenantId,
    UUID projectId,
    String title,
    String description,
    DesignOptionStatus status,
    DesignDiscipline discipline,
    String metadata,
    UUID thumbnailDocumentId,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt,
    Long rowVersion
) {}
