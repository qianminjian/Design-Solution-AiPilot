package com.platform.core.operations.domain.enums;

/**
 * 连接器健康状态
 *
 * 与前端 ConnectorHealthStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum ConnectorHealthStatus {
    /** 已连接（健康，调用正常） */
    CONNECTED,
    /** 降级（可用但错误率/延迟超阈值） */
    DEGRADED,
    /** 已断开（不可达或鉴权失败） */
    DISCONNECTED,
    /** 未知（首次启动或心跳丢失） */
    UNKNOWN
}
