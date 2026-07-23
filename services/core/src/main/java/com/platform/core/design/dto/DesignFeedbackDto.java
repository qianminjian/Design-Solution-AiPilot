package com.platform.core.design.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 设计反馈 DTO
 */
public record DesignFeedbackDto(
    UUID id,
    UUID optionId,
    UUID authorId,
    String comment,
    Integer rating,
    Instant createdAt
) {}
