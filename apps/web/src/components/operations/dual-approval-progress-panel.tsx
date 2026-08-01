"use client";

import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { OperationsActionResponseDto } from "@design-platform/shared";
import {
  DUAL_APPROVAL_STATUS_COLOR,
  DUAL_APPROVAL_STATUS_LABEL,
} from "@design-platform/shared";
import { computeDualApprovalProgress } from "@/hooks/use-monitoring-operations";

const { Text } = Typography;

/**
 * 双人审批进度面板（D37.23 §不可逆/合规：二人审批）
 *
 * 展示内容：
 *  - 当前审批状态（Steps 4 步：发起 → 审批1 → 审批2 → 完成）
 *  - 审批人1 / 审批人2 头像、ID、时间、意见
 *  - 审批进度百分比
 *  - 拒绝状态高亮显示
 *
 * 安全约束：
 *  - 仅展示，不触发任何写操作（写操作走 DualApprovalModal）
 *  - 审批意见完整展示（进入审计日志，不可篡改）
 */

/** 单个审批人卡片 */
function ReviewerCard({
  label,
  reviewerId,
  reviewedAt,
  comment,
  isApproved,
  isRejected,
}: {
  label: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  comment?: string | null;
  isApproved: boolean;
  isRejected: boolean;
}) {
  if (!reviewerId) {
    return (
      <Card size="small" type="inner" title={label}>
        <Space>
          <Avatar
            icon={<UserOutlined />}
            style={{ backgroundColor: "#bfbfbf" }}
          />
          <Text type="secondary">待审批</Text>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          {label}
          {isApproved && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              已通过
            </Tag>
          )}
          {isRejected && (
            <Tag icon={<CloseCircleOutlined />} color="error">
              已拒绝
            </Tag>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Space>
          <Avatar
            icon={<UserOutlined />}
            style={{ backgroundColor: "#722ed1" }}
          />
          <Text code>{reviewerId}</Text>
        </Space>
        {reviewedAt && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            <ClockCircleOutlined />{" "}
            {new Date(reviewedAt).toLocaleString("zh-CN")}
          </Text>
        )}
        {comment && (
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="审批意见">{comment}</Descriptions.Item>
          </Descriptions>
        )}
      </Space>
    </Card>
  );
}

/** 双人审批进度面板 */
export function DualApprovalProgressPanel({
  action,
  onApproveReview1,
  onRejectReview1,
  onApproveReview2,
  onRejectReview2,
}: {
  action: OperationsActionResponseDto;
  onApproveReview1?: () => void;
  onRejectReview1?: () => void;
  onApproveReview2?: () => void;
  onRejectReview2?: () => void;
}) {
  const status = action.dualApprovalStatus ?? "not_required";

  if (status === "not_required") {
    return (
      <Card size="small" type="inner" title="双人审批">
        <Text type="secondary">该动作无需双人审批</Text>
      </Card>
    );
  }

  const progress = computeDualApprovalProgress(status);
  const isReview1Done = Boolean(action.reviewer1Id);
  const isReview2Done = Boolean(action.reviewer2Id);
  const isRejected =
    status === "rejected_review1" || status === "rejected_review2";
  const isApproved = status === "approved";

  // Steps 当前 step 索引
  const currentStep = (() => {
    switch (status) {
      case "pending_review1":
        return 0;
      case "pending_review2":
        return 1;
      case "approved":
        return 2;
      case "rejected_review1":
      case "rejected_review2":
        return 1; // 错误终止
      default:
        return 0;
    }
  })();

  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <SafetyCertificateOutlined />
          <Text strong>双人审批</Text>
          <Tag color={DUAL_APPROVAL_STATUS_COLOR[status]}>
            {DUAL_APPROVAL_STATUS_LABEL[status]}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 进度条 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            审批进度
          </Text>
          <Progress
            percent={progress}
            status={
              isRejected ? "exception" : isApproved ? "success" : "active"
            }
            size="small"
          />
        </div>

        {/* Steps 流转可视化 */}
        <Steps
          size="small"
          current={currentStep}
          status={isRejected ? "error" : isApproved ? "finish" : "process"}
          items={[
            {
              title: "发起",
              description: action.initiatedBy
                ? `发起人: ${action.initiatedBy}`
                : "",
            },
            {
              title: "审批人1",
              description: isReview1Done
                ? action.reviewer1Id
                : status === "pending_review1"
                  ? "等待审批"
                  : "",
            },
            {
              title: "审批人2",
              description: isReview2Done
                ? action.reviewer2Id
                : status === "pending_review2"
                  ? "等待审批"
                  : "",
            },
          ]}
        />

        {/* 审批人卡片 */}
        <Space
          size="middle"
          style={{ width: "100%" }}
          styles={{ item: { flex: 1 } }}
        >
          <div style={{ flex: 1 }}>
            <ReviewerCard
              label="审批人1"
              reviewerId={action.reviewer1Id}
              reviewedAt={action.reviewer1At}
              comment={action.reviewer1Comment}
              isApproved={status === "approved" || status === "pending_review2"}
              isRejected={status === "rejected_review1"}
            />
          </div>
          <div style={{ flex: 1 }}>
            <ReviewerCard
              label="审批人2"
              reviewerId={action.reviewer2Id}
              reviewedAt={action.reviewer2At}
              comment={action.reviewer2Comment}
              isApproved={status === "approved"}
              isRejected={status === "rejected_review2"}
            />
          </div>
        </Space>

        {/* 审计追踪 */}
        {action.auditTraceId && (
          <Tooltip title="审计追踪 ID（用于追溯全链路操作日志）">
            <Text type="secondary" style={{ fontSize: 11 }}>
              审计追踪: <Text code>{action.auditTraceId}</Text>
            </Text>
          </Tooltip>
        )}

        {/* 操作按钮（仅 pending 状态显示） */}
        {status === "pending_review1" &&
          onApproveReview1 &&
          onRejectReview1 && (
            <Space>
              <Button type="primary" onClick={onApproveReview1}>
                审批人1 通过
              </Button>
              <Button danger onClick={onRejectReview1}>
                审批人1 拒绝
              </Button>
            </Space>
          )}
        {status === "pending_review2" &&
          onApproveReview2 &&
          onRejectReview2 && (
            <Space>
              <Button type="primary" onClick={onApproveReview2}>
                审批人2 通过
              </Button>
              <Button danger onClick={onRejectReview2}>
                审批人2 拒绝
              </Button>
            </Space>
          )}
      </Space>
    </Card>
  );
}
