package com.platform.core.operations.connector.dto;

import com.platform.core.operations.domain.enums.ConnectorType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 连接器注册请求 DTO
 *
 * <p>连接器初始化时调用 POST /api/v1/operations/connectors/register 注册自身。
 * 同一 connectorCode 已存在时更新记录（幂等注册）。
 *
 * <p>安全红线（对齐 OD-05 外部 AI 接入约束）：
 * <ul>
 *   <li>AI_PROVIDER 类型（建筑 AI Provider）强制 isManualHandoff=true（V1 不自动接入）</li>
 *   <li>跨 Region 注册需校验数据驻留约束</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
public record ConnectorRegisterRequest(
        /** 连接器业务编号（如 "deepseek-llm-001"） */
        @NotBlank
        @Size(max = 128)
        String connectorCode,

        /** 连接器名称（显示用） */
        @NotBlank
        @Size(max = 200)
        String name,

        /** 连接器类型 */
        @NotNull
        ConnectorType type,

        /** 部署 Region（Hybrid-Site 部署标识） */
        @Size(max = 64)
        String region,

        /** 端点 URL（可选，连接器调用地址） */
        @Size(max = 500)
        String endpointUrl,

        /** 许可证剩余描述（如 "30 days" / "5000 calls"） */
        @Size(max = 200)
        String licenseRemaining,

        /** 是否为 ManualHandoff（OD-05 外部 AI V1 约束，建筑 AI Provider 强制 true） */
        boolean isManualHandoff
) {
}
