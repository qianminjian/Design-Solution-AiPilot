"use client";

import { Card, Empty, List, Tag, Typography, Tooltip, Spin } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { GateDecisionDto, GateDecision } from "@design-platform/shared";

const { Text, Paragraph } = Typography;

/** 门禁决策结论 → 展示文本 */
const GATE_DECISION_LABEL: Record<GateDecision, string> = {
  approved: "Approved",
  conditionally_approved: "Conditionally Approved",
  rework_required: "Rework Required",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

/** 门禁决策结论 → Tag 颜色 */
const GATE_DECISION_TAG_COLOR: Record<GateDecision, string> = {
  approved: "success",
  conditionally_approved: "warning",
  rework_required: "warning",
  suspended: "warning",
  cancelled: "error",
};

/** 门禁决策结论 → 图标 */
function GateDecisionIcon({ decision }: { decision: GateDecision }) {
  switch (decision) {
    case "approved":
      return <CheckCircleOutlined style={{ color: "#16a34a" }} />;
    case "conditionally_approved":
      return <ExclamationCircleOutlined style={{ color: "#d97706" }} />;
    case "rework_required":
      return <WarningOutlined style={{ color: "#d97706" }} />;
    case "suspended":
      return <PauseCircleOutlined style={{ color: "#d97706" }} />;
    case "cancelled":
      return <CloseCircleOutlined style={{ color: "#dc2626" }} />;
  }
}

/** 门禁状态 → 展示文本 */
const GATE_STATUS_LABEL = {
  pending: "Pending",
  decided: "Decided",
  cancelled: "Cancelled",
} as const;

/** ISO 时间 → 本地化展示 */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface GateDecisionListProps {
  /** 门禁决策列表 */
  gates: GateDecisionDto[];
  /** 加载态 */
  loading?: boolean;
}

/**
 * 门禁决策卡片列表
 * 每张卡片展示：门禁编码 / 名称 / 决策结论 / 决策人 / 时间 / 备注
 *
 * 参考 design-ui-system 的卡片样式（白底 + 边框 + 圆角）
 */
export function GateDecisionList({ gates, loading }: GateDecisionListProps) {
  return (
    <Card title="Gate Decisions" style={{ height: "100%" }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Spin />
        </div>
      ) : gates.length === 0 ? (
        <Empty description="暂无门禁决策记录" />
      ) : (
        <List<GateDecisionDto>
          dataSource={gates}
          renderItem={(gate) => (
            <List.Item style={{ alignItems: "flex-start", padding: "12px 0" }}>
              <div style={{ width: "100%" }}>
                {/* 头部：门禁编码 + 名称 + 决策结论 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  <Tooltip title={gate.gateCode}>
                    <Tag color="blue" style={{ margin: 0 }}>
                      {gate.gateCode}
                    </Tag>
                  </Tooltip>
                  <Text strong>{gate.gateName}</Text>
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {gate.decision ? (
                      <>
                        <GateDecisionIcon decision={gate.decision} />
                        <Tag
                          color={GATE_DECISION_TAG_COLOR[gate.decision]}
                          style={{ margin: 0 }}
                        >
                          {GATE_DECISION_LABEL[gate.decision]}
                        </Tag>
                      </>
                    ) : (
                      <>
                        <ClockCircleOutlined style={{ color: "#94a3b8" }} />
                        <Tag style={{ margin: 0 }}>
                          {GATE_STATUS_LABEL[gate.status]}
                        </Tag>
                      </>
                    )}
                  </div>
                </div>

                {/* 元信息：决策人 / 决策时间 */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: "#64748b",
                    marginBottom: gate.comment ? 4 : 0,
                  }}
                >
                  <span>
                    Decided by:{" "}
                    <Text type="secondary">{gate.decidedBy ?? "—"}</Text>
                  </span>
                  <span>
                    Decided at:{" "}
                    <Text type="secondary">
                      {formatDateTime(gate.decidedAt)}
                    </Text>
                  </span>
                </div>

                {/* 备注 */}
                {gate.comment && (
                  <Paragraph
                    type="secondary"
                    style={{ margin: 0, fontSize: 13 }}
                  >
                    {gate.comment}
                  </Paragraph>
                )}
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
