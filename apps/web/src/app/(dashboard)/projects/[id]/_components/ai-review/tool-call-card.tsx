"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import type { ToolCallDto } from "@design-platform/shared";
import {
  TOOL_CALL_STATUS_COLOR,
  TOOL_CALL_STATUS_LABEL,
  useApproveToolCall,
} from "@/hooks/use-ai-review";

const { Text, Paragraph } = Typography;

/**
 * P09 中栏：ToolCall 卡片
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13 §布局「工具调用」
 *
 * 功能：
 *  - 展示工具调用元数据（名称、版本、状态、耗时）
 *  - 状态为 AWAITING_APPROVAL 时展示审批按钮（Approve/Reject）
 *  - 高风险工具调用（requiresApproval=true）需 stepUpToken 二次认证
 *  - 输入/输出 JSON 可折叠
 *
 * 安全红线：
 *  - 高风险审批需 stepUpToken（V0 占位，实际由 BFF 校验）
 *  - 拒绝需明确原因（D37.13 §决策"必须 reason"）
 */

/** JSON 内容渲染（折叠/展开） */
function JsonBlock({
  data,
  emptyText = "无内容",
  maxHeight = 240,
}: {
  data: unknown;
  emptyText?: string;
  maxHeight?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (data === null || data === undefined) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {emptyText}
      </Text>
    );
  }
  let jsonText: string;
  try {
    jsonText = JSON.stringify(data, null, 2);
  } catch {
    jsonText = String(data);
  }
  const display = expanded ? jsonText : jsonText.slice(0, 200);
  const truncated = jsonText.length > 200;
  return (
    <div>
      <Paragraph
        style={{
          background: "#fafafa",
          padding: 8,
          borderRadius: 4,
          fontSize: 11,
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
          margin: 0,
          maxHeight: expanded ? undefined : maxHeight,
          overflow: "auto",
        }}
      >
        {display}
        {truncated && !expanded ? "..." : ""}
      </Paragraph>
      {truncated && (
        <Button
          type="link"
          size="small"
          onClick={() => setExpanded(!expanded)}
          style={{ padding: "4px 0", fontSize: 11 }}
        >
          {expanded ? "收起" : "展开全部"}
        </Button>
      )}
    </div>
  );
}

export interface ToolCallCardProps {
  /** 工具调用 DTO */
  toolCall: ToolCallDto;
  /** 是否需要 stepUpToken（默认根据 requiresApproval 自动判断） */
  requireStepUpToken?: boolean;
}

export function ToolCallCard({
  toolCall,
  requireStepUpToken,
}: ToolCallCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [stepUpToken, setStepUpToken] = useState("");
  const approveMutation = useApproveToolCall();

  const isAwaitingApproval = toolCall.status === "AWAITING_APPROVAL";
  const needStepUp = requireStepUpToken ?? toolCall.requiresApproval;
  const isHighRisk = toolCall.requiresApproval;

  // 处理批准
  const handleApprove = () => {
    approveMutation.mutate({
      toolCallId: toolCall.id,
      action: "APPROVE",
      stepUpToken: needStepUp ? stepUpToken || undefined : undefined,
    });
  };

  // 处理拒绝
  const handleReject = () => {
    if (!rejectReason.trim()) return;
    approveMutation.mutate({
      toolCallId: toolCall.id,
      action: "REJECT",
      reason: rejectReason.trim(),
      stepUpToken: needStepUp ? stepUpToken || undefined : undefined,
    });
    setRejectOpen(false);
    setRejectReason("");
  };

  return (
    <Card
      size="small"
      title={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Space size={4}>
            <ToolOutlined />
            <Text strong style={{ fontSize: 13 }}>
              {toolCall.toolName}
            </Text>
            {toolCall.toolVersion && (
              <Tag style={{ fontSize: 10 }}>v{toolCall.toolVersion}</Tag>
            )}
            {isHighRisk && (
              <Tooltip title="高风险工具调用，需 stepUpToken 二次认证">
                <Tag color="red" style={{ fontSize: 10 }}>
                  <SafetyCertificateOutlined /> 高风险
                </Tag>
              </Tooltip>
            )}
          </Space>
          <Tag
            color={TOOL_CALL_STATUS_COLOR[toolCall.status]}
            style={{ fontSize: 10 }}
          >
            {TOOL_CALL_STATUS_LABEL[toolCall.status]}
          </Tag>
        </div>
      }
    >
      {/* 描述 */}
      <Descriptions
        size="small"
        column={2}
        labelStyle={{ fontSize: 11, width: 80 }}
        contentStyle={{ fontSize: 11 }}
      >
        <Descriptions.Item label="状态">
          <Tag
            color={TOOL_CALL_STATUS_COLOR[toolCall.status]}
            style={{ fontSize: 10 }}
          >
            {TOOL_CALL_STATUS_LABEL[toolCall.status]}
          </Tag>
        </Descriptions.Item>
        {toolCall.latencyMs !== null && toolCall.latencyMs !== undefined && (
          <Descriptions.Item label="耗时">
            <ClockCircleOutlined /> {(toolCall.latencyMs / 1000).toFixed(2)}s
          </Descriptions.Item>
        )}
        {toolCall.requiresApproval && (
          <Descriptions.Item label="需要审批">
            <Tag color="orange" style={{ fontSize: 10 }}>
              是
            </Tag>
          </Descriptions.Item>
        )}
        {toolCall.approvedBy && (
          <Descriptions.Item label="审批人">
            {toolCall.approvedBy}
          </Descriptions.Item>
        )}
        {toolCall.approvedAt && (
          <Descriptions.Item label="审批时间">
            {new Date(toolCall.approvedAt).toLocaleString("zh-CN")}
          </Descriptions.Item>
        )}
      </Descriptions>

      {toolCall.description && (
        <Paragraph
          type="secondary"
          style={{ fontSize: 11, marginTop: 4, marginBottom: 8 }}
        >
          {toolCall.description}
        </Paragraph>
      )}

      {/* 输入参数 */}
      <div style={{ marginTop: 8 }}>
        <Text strong style={{ fontSize: 12 }}>
          输入参数
        </Text>
        <div style={{ marginTop: 4 }}>
          <JsonBlock data={toolCall.input} emptyText="无输入参数" />
        </div>
      </div>

      {/* 输出结果 */}
      <div style={{ marginTop: 8 }}>
        <Text strong style={{ fontSize: 12 }}>
          输出结果
        </Text>
        <div style={{ marginTop: 4 }}>
          <JsonBlock
            data={toolCall.output}
            emptyText="暂无输出（执行中或失败）"
          />
        </div>
      </div>

      {/* 错误信息 */}
      {toolCall.errorMessage && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="执行失败"
          description={toolCall.errorMessage}
          style={{ marginTop: 8 }}
        />
      )}

      {/* 拒绝原因 */}
      {toolCall.rejectionReason && (
        <Alert
          type="warning"
          showIcon
          message="拒绝原因"
          description={toolCall.rejectionReason}
          style={{ marginTop: 8 }}
        />
      )}

      {/* 审批按钮 */}
      {isAwaitingApproval && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            borderRadius: 4,
          }}
        >
          <Text strong style={{ fontSize: 12, color: "#d48806" }}>
            <ExclamationCircleOutlined /> 等待人工审批
          </Text>
          {needStepUp && (
            <div style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11 }}>Step-up Token：</Text>
              <Input.Password
                size="small"
                placeholder="高风险审批需输入 Step-up Token"
                value={stepUpToken}
                onChange={(e) => setStepUpToken(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
          )}
          <Space style={{ marginTop: 8 }}>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={approveMutation.isPending}
              onClick={handleApprove}
            >
              批准执行
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectOpen(true)}
            >
              拒绝
            </Button>
          </Space>
        </div>
      )}

      {/* 拒绝原因 Modal */}
      <Modal
        title="拒绝工具调用"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        confirmLoading={approveMutation.isPending}
        okText="提交拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="info"
          showIcon
          message="拒绝需明确原因"
          description="对齐 D37.13 §决策：所有决策必须填写 reason，便于追溯审计。"
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={4}
          placeholder="请说明拒绝原因（必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </Card>
  );
}
