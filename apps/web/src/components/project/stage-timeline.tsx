"use client";

import { Card, Empty, Spin, Tag, Tooltip, Typography } from "antd";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  SyncOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
} from "@ant-design/icons";
import type { StageInstanceDto, StageStatus } from "@design-platform/shared";

const { Title, Text } = Typography;

/**
 * 阶段状态 → 视觉分类（用于时间线节点配色）
 * 参考 design-ui-system/pages/project-home.html 的门控横条配色
 * - 已完成：绿色（closed / approved / conditionally_approved）
 * - 进行中：蓝色（active / review_preparing / under_review）
 * - 未开始：灰色（planned）
 * - 异常：橙色（suspended）/ 红色（cancelled）
 */
type StageVisualStatus =
  "completed" | "active" | "pending" | "warning" | "error";

const STAGE_STATUS_VISUAL: Record<StageStatus, StageVisualStatus> = {
  planned: "pending",
  active: "active",
  review_preparing: "active",
  under_review: "active",
  conditionally_approved: "completed",
  approved: "completed",
  suspended: "warning",
  cancelled: "error",
  closed: "completed",
};

/** 视觉状态 → 节点背景色 */
const VISUAL_BG_COLOR: Record<StageVisualStatus, string> = {
  completed: "#16a34a", // state-success
  active: "#2563eb", // bd-primary-600
  pending: "#e2e8f0", // bd-slate-200
  warning: "#d97706", // state-warning
  error: "#dc2626", // state-error
};

/** 视觉状态 → 节点文字色 */
const VISUAL_TEXT_COLOR: Record<StageVisualStatus, string> = {
  completed: "#ffffff",
  active: "#ffffff",
  pending: "#94a3b8", // bd-slate-400
  warning: "#ffffff",
  error: "#ffffff",
};

/** 视觉状态 → 连接线颜色（已走过的路径） */
const VISUAL_LINE_COLOR: Record<StageVisualStatus, string> = {
  completed: "#16a34a",
  active: "#2563eb",
  pending: "#e2e8f0",
  warning: "#d97706",
  error: "#dc2626",
};

/** 阶段状态 → 展示文本 */
const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  planned: "Planned",
  active: "Active",
  review_preparing: "Review Preparing",
  under_review: "Under Review",
  conditionally_approved: "Conditionally Approved",
  approved: "Approved",
  suspended: "Suspended",
  cancelled: "Cancelled",
  closed: "Closed",
};

/** 阶段状态 → Tag 颜色 */
const STAGE_STATUS_TAG_COLOR: Record<StageStatus, string> = {
  planned: "default",
  active: "processing",
  review_preparing: "processing",
  under_review: "processing",
  conditionally_approved: "success",
  approved: "success",
  suspended: "warning",
  cancelled: "error",
  closed: "success",
};

/** 阶段状态 → 图标 */
function StageStatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "approved":
    case "conditionally_approved":
    case "closed":
      return <CheckCircleFilled />;
    case "active":
    case "review_preparing":
    case "under_review":
      return <SyncOutlined spin />;
    case "suspended":
      return <PauseCircleOutlined />;
    case "cancelled":
      return <CloseCircleOutlined />;
    case "planned":
    default:
      return <ClockCircleOutlined />;
  }
}

interface StageTimelineProps {
  /** 阶段实例列表（应已按 stageOrder 升序） */
  stages: StageInstanceDto[];
  /** 当前进行中的阶段 ID（用于高亮，可选；不传则按状态自动判定） */
  activeStageId?: string | null;
  /** 加载态 */
  loading?: boolean;
}

/**
 * 阶段时间线（横向）
 * - 节点：阶段名 + 状态图标 + 状态色
 * - 连接线：已走过的阶段用状态色，未开始用浅灰
 * - 节点下方显示阶段编码与状态 Tag
 *
 * 参考 design-ui-system/pages/project-home.html 的门控横条
 */
export function StageTimeline({
  stages,
  activeStageId,
  loading,
}: StageTimelineProps) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <LockOutlined style={{ color: "#2563eb" }} />
        <Title level={5} style={{ margin: 0, color: "#2563eb" }}>
          Project Stage Progress
        </Title>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Spin />
        </div>
      ) : stages.length === 0 ? (
        <Empty description="暂无阶段实例" />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            overflowX: "auto",
            padding: "8px 0 16px",
          }}
          role="list"
          aria-label="项目阶段时间线"
        >
          {stages.map((stage, index) => {
            const visual = STAGE_STATUS_VISUAL[stage.status];
            const isActive = activeStageId === stage.id || visual === "active";
            const isLast = index === stages.length - 1;
            // 连接线颜色：当前节点为 completed/active 时，其左侧线段已走过
            const lineColor =
              visual === "completed" || visual === "active"
                ? VISUAL_LINE_COLOR[visual]
                : VISUAL_LINE_COLOR.pending;

            return (
              <div
                key={stage.id}
                role="listitem"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  minWidth: 120,
                  position: "relative",
                }}
              >
                {/* 节点行：圆点 + 连接线 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    position: "relative",
                    height: 32,
                  }}
                >
                  {/* 左侧连接线（第一个节点不渲染） */}
                  {index > 0 && (
                    <div
                      style={{
                        flex: 1,
                        height: 3,
                        background:
                          visual === "completed" || visual === "active"
                            ? VISUAL_LINE_COLOR[visual]
                            : VISUAL_LINE_COLOR.pending,
                      }}
                    />
                  )}
                  {/* 圆点节点 */}
                  <Tooltip
                    title={`${stage.stageName} · ${STAGE_STATUS_LABEL[stage.status]}`}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: VISUAL_BG_COLOR[visual],
                        color: VISUAL_TEXT_COLOR[visual],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                        boxShadow: isActive
                          ? "0 0 0 4px rgba(37, 99, 235, 0.12)"
                          : "none",
                        transition: "box-shadow 200ms ease",
                      }}
                      aria-label={`${stage.stageName}, 状态 ${STAGE_STATUS_LABEL[stage.status]}`}
                    >
                      <StageStatusIcon status={stage.status} />
                    </div>
                  </Tooltip>
                  {/* 右侧连接线（最后一个节点不渲染） */}
                  {!isLast && (
                    <div
                      style={{
                        flex: 1,
                        height: 3,
                        background: lineColor,
                      }}
                    />
                  )}
                </div>

                {/* 阶段名 */}
                <Text
                  style={{
                    fontWeight: 600,
                    color:
                      visual === "pending"
                        ? "#64748b"
                        : VISUAL_LINE_COLOR[visual],
                    textAlign: "center",
                    fontSize: 12,
                    lineHeight: 1.3,
                  }}
                >
                  {stage.stageName}
                </Text>

                {/* 阶段编码 + 状态 Tag */}
                <Tag
                  color={STAGE_STATUS_TAG_COLOR[stage.status]}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {stage.stageCode}
                </Tag>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
