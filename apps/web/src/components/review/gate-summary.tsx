"use client";

import { Card, Tag, Progress, Statistic, Empty } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { GateSummary } from "@/hooks/use-review";

interface GateSummaryProps {
  data: GateSummary | null;
  loading?: boolean;
}

const statusConfig = {
  pass: {
    color: "green",
    label: "通过",
    icon: CheckCircleOutlined,
    bgColor: "#f6ffed",
    borderColor: "#b7eb8f",
  },
  fail: {
    color: "red",
    label: "未通过",
    icon: CloseCircleOutlined,
    bgColor: "#fff1f0",
    borderColor: "#ffccc7",
  },
  pending: {
    color: "orange",
    label: "待决策",
    icon: ClockCircleOutlined,
    bgColor: "#fffbe6",
    borderColor: "#ffe58f",
  },
};

export function GateSummaryCard({ data, loading }: GateSummaryProps) {
  if (loading) {
    return (
      <Card size="small" loading>
        <div style={{ height: 150 }} />
      </Card>
    );
  }

  if (!data) {
    return <Empty description="暂无门禁数据" />;
  }

  const status = statusConfig[data.status];
  const StatusIcon = status.icon;

  return (
    <Card
      size="small"
      style={{
        borderLeft: `4px solid ${status.borderColor}`,
        backgroundColor: status.bgColor,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Tag color={status.color} style={{ marginBottom: 8 }}>
            {data.stageCode} - {data.stageName}
          </Tag>
          <h3 style={{ margin: 0 }}>{data.gateName}</h3>
          <div style={{ color: "#666", fontSize: 12 }}>{data.gateCode} 门禁</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            backgroundColor: "white",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <StatusIcon style={{ color: status.color, fontSize: 20 }} />
          <span style={{ fontWeight: 600, color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Statistic
          title="通过率"
          value={Math.round(data.passRate * 100)}
          suffix="%"
          valueStyle={{ color: data.passRate >= 0.8 ? "#52c41a" : "#faad14" }}
        />
        <Statistic
          title="未决项"
          value={data.pendingItems}
          valueStyle={{ color: data.pendingItems > 0 ? "#ff4d4f" : "#52c41a" }}
          prefix={<ClockCircleOutlined />}
        />
        <Statistic
          title="发现总数"
          value={data.totalFindings}
          valueStyle={{ color: "#1890ff" }}
        />
        <Statistic
          title="严重发现"
          value={data.criticalFindings}
          valueStyle={{ color: data.criticalFindings > 0 ? "#ff4d4f" : "#52c41a" }}
          prefix={<WarningOutlined />}
        />
      </div>

      {data.passRate > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#666" }}>门禁通过进度</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {Math.round(data.passRate * 100)}%
            </span>
          </div>
          <Progress
            percent={Math.round(data.passRate * 100)}
            strokeColor={
              data.passRate >= 0.8 ? "#52c41a" : data.passRate >= 0.5 ? "#faad14" : "#ff4d4f"
            }
          />
        </div>
      )}
    </Card>
  );
}