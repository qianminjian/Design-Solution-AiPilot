package com.platform.core.operations.connector.dto;

import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;

import java.time.Instant;
import java.util.UUID;

/**
 * 连接器状态 DTO（对齐前端 ConnectorStatusDto 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record ConnectorStatusDto(
        UUID id,
        String name,
        ConnectorType type,
        ConnectorHealthStatus status,
        long callCount1h,
        long errorCount1h,
        int avgLatencyMs,
        String licenseRemaining,
        Instant lastUsedAt,
        boolean isManualHandoff
) {
}
