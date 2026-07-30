package com.platform.core.operations.connector.dto;

import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;

/**
 * 列出连接器请求（对齐前端 ListConnectorsRequest 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record ListConnectorsRequest(
        ConnectorType type,
        ConnectorHealthStatus status,
        String keyword
) {
}
