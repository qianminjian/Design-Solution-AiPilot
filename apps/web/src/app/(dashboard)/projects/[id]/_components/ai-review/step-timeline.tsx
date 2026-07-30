"use client";

import { Alert, Empty, Spin, Tag, Timeline, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { AiStepDto, AiStepStatus } from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Text } = Typography;

/**
 * P09 左栏：Step 时间线
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13 §布局「Step 时间线」
 *
 * 功能：
 *  - 列出 Run 下所有执行步骤
 *  - 选中 Step 后联动中部 ToolCall/Guardrail 过滤
 *  - 显示每步状态、耗时与错误
 *
 * V0：后端 AI Step API 未实现时显示空状态
 */

const STEP_STATUS_COLOR: Record<AiStepStatus, string> = {
  PENDING: "default",
  RUNNING: "processing",
  AWAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "error",
  SKIPPED: "default",
};

const STEP_STATUS_LABEL: Record<AiStepStatus, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  AWAITING_APPROVAL: "等待审批",
  COMPLETED: "已完成",
  FAILED: "失败",
  SKIPPED: "已跳过",
};

const STEP_TYPE_LABEL: Record<AiStepDto["type"], string> = {
  PLAN: "规划",
  TOOL_CALL: "工具调用",
  OBSERVE: "观察",
  REFLECT: "反思",
  OUTPUT: "输出",
};

function getStepIcon(status: AiStepStatus) {
  switch (status) {
    case "RUNNING":
      return <LoadingOutlined style={{ color: "#1677ff" }} />;
    case "AWAITING_APPROVAL":
      return <ExclamationCircleOutlined style={{ color: "#faad14" }} />;
    case "COMPLETED":
      return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
    case "FAILED":
      return <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />;
    case "SKIPPED":
      return <MinusCircleOutlined style={{ color: "#bfbfbf" }} />;
    default:
      return <ClockCircleOutlined style={{ color: "#bfbfbf" }} />;
  }
}

export interface StepTimelineProps {
  /** 步骤列表 */
  steps: AiStepDto[];
  /** 当前选中的步骤 ID */
  selectedStepId: string | null;
  /** 选中步骤回调 */
  onSelect: (stepId: string | null) => void;
  /** 加载状态 */
  loading: boolean;
  /** 错误对象 */
  error: unknown;
}

export function StepTimeline({
  steps,
  selectedStepId,
  onSelect,
  loading,
  error,
}: StepTimelineProps) {
  // 头部
  const header = (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid #f0f0f0",
        background: "#fafafa",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text strong style={{ fontSize: 13 }}>
        <ThunderboltOutlined /> Step 时间线
      </Text>
      <Tag style={{ fontSize: 11 }}>{steps.length} 步</Tag>
    </div>
  );

  // 加载状态
  if (loading) {
    return (
      <>
        {header}
        <div style={{ textAlign: "center", padding: 24, flex: 1 }}>
          <Spin />
        </div>
      </>
    );
  }

  // 错误状态
  if (error) {
    return (
      <>
        {header}
        <div style={{ padding: 12, flex: 1 }}>
          <DataErrorAlert error={error} context="步骤列表" />
        </div>
      </>
    );
  }

  // 空状态
  if (steps.length === 0) {
    return (
      <>
        {header}
        <div style={{ padding: 12, flex: 1 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12 }}>
                暂无执行步骤
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  非 Agent 模式（如 CHAT/RAG）可能无步骤记录
                </Text>
              </span>
            }
          />
        </div>
      </>
    );
  }

  // 时间线
  return (
    <>
      {header}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        <Timeline
          items={steps.map((step) => {
            const isSelected = step.id === selectedStepId;
            return {
              dot: getStepIcon(step.status),
              color: STEP_STATUS_COLOR[step.status],
              children: (
                <div
                  onClick={() => onSelect(isSelected ? null : step.id)}
                  style={{
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: isSelected ? "#e6f4ff" : "transparent",
                    border: isSelected
                      ? "1px solid #91caff"
                      : "1px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <Text strong style={{ fontSize: 12 }}>
                      <PlayCircleOutlined style={{ marginRight: 4 }} />
                      Step {step.stepIndex} · {step.name}
                    </Text>
                    <Tag
                      color={STEP_STATUS_COLOR[step.status]}
                      style={{ fontSize: 10, margin: 0 }}
                    >
                      {STEP_STATUS_LABEL[step.status]}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    <Tag style={{ fontSize: 10, margin: 0 }}>
                      {STEP_TYPE_LABEL[step.type]}
                    </Tag>
                    {step.latencyMs !== null &&
                      step.latencyMs !== undefined && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 10, marginLeft: 4 }}
                        >
                          耗时 {(step.latencyMs / 1000).toFixed(2)}s
                        </Text>
                      )}
                    {step.toolCallIds.length > 0 && (
                      <Tooltip title={`${step.toolCallIds.length} 个工具调用`}>
                        <Tag
                          color="blue"
                          style={{ fontSize: 10, marginLeft: 4 }}
                        >
                          TC: {step.toolCallIds.length}
                        </Tag>
                      </Tooltip>
                    )}
                    {step.guardrailIds.length > 0 && (
                      <Tooltip title={`${step.guardrailIds.length} 个护栏`}>
                        <Tag
                          color="purple"
                          style={{ fontSize: 10, marginLeft: 4 }}
                        >
                          GR: {step.guardrailIds.length}
                        </Tag>
                      </Tooltip>
                    )}
                  </div>
                  {step.errorMessage && (
                    <Alert
                      type="error"
                      showIcon={false}
                      message={step.errorMessage}
                      style={{
                        marginTop: 4,
                        padding: "2px 8px",
                        fontSize: 11,
                      }}
                    />
                  )}
                </div>
              ),
            };
          })}
        />
      </div>
    </>
  );
}
