"use client";

import { Card, Statistic, Tag } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

/**
 * 服务状态卡片（D37.17 Monitoring 概览）
 *
 * 显示 BFF/Core/AI/PostgreSQL/MinIO/ChromaDB 等核心服务的健康状态：
 *  - UP：绿色 ✓
 *  - DOWN：红色 ✗，附 error 信息
 *  - 延迟：durationMs（来自 details）
 */
export function ServiceCard({
  label,
  icon,
  health,
}: {
  label: string;
  icon: React.ReactNode;
  health?:
    | {
        status: "UP" | "DOWN";
        error?: string;
        details?: Record<string, unknown>;
      }
    | undefined;
}) {
  const isUp = health?.status === "UP";
  return (
    <Card size="small" hoverable>
      <Statistic
        title={label}
        value={isUp ? "UP" : "DOWN"}
        prefix={icon}
        valueStyle={{
          color: isUp ? "#3f8600" : "#cf1322",
          fontSize: 20,
        }}
        suffix={
          isUp ? (
            <CheckCircleOutlined style={{ fontSize: 16 }} />
          ) : (
            <CloseCircleOutlined style={{ fontSize: 16 }} />
          )
        }
      />
      {health?.error && (
        <Tag color="red" style={{ marginTop: 8 }}>
          {health.error}
        </Tag>
      )}
      {health?.details?.durationMs !== undefined && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
          延迟: {health.details.durationMs as number}ms
        </div>
      )}
    </Card>
  );
}
