"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, App, Input, Modal, Space, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useStepUpToken } from "@/hooks/use-step-up";
import {
  useApproveReview1,
  useApproveReview2,
  useRejectReview1,
  useRejectReview2,
  computeReview2WaitMs,
} from "@/hooks/use-monitoring-operations";
import {
  DUAL_APPROVAL_MIN_INTERVAL_MS,
  type OperationsActionResponseDto,
} from "@design-platform/shared";

const { Text, Paragraph } = Typography;

/**
 * 双人审批操作模态框（D37.23 §不可逆/合规：二人审批）
 *
 * 交互流程：
 *  1. 用户点击"通过/拒绝"按钮 → 弹出本模态框
 *  2. 输入当前用户密码 → 调用 /auth/step-up 申请 stepUpToken
 *  3. 输入审批意见（必填，进入审计日志）
 *  4. 若为审批人2：检查距审批人1的时间间隔，未满 5 秒则倒计时禁用提交
 *  5. 提交审批 → 调用对应 review1/review2 approve/reject 端点
 *
 * 安全约束：
 *  - stepUpToken 必须真实有效（后端 HS256 校验）
 *  - 审批意见非空且 ≤ 500 字
 *  - 审批人2 须等待审批人1 ≥ 5 秒（防止快速攻击）
 */

export type DualApprovalAction =
  "approve_review1" | "reject_review1" | "approve_review2" | "reject_review2";

export function DualApprovalModal({
  open,
  action,
  actionKind,
  onClose,
  onSuccess,
}: {
  open: boolean;
  action: OperationsActionResponseDto | null;
  actionKind: DualApprovalAction | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { message } = App.useApp();
  const stepUpMutation = useStepUpToken();
  const approveReview1 = useApproveReview1();
  const rejectReview1 = useRejectReview1();
  const approveReview2 = useApproveReview2();
  const rejectReview2 = useRejectReview2();

  const [password, setPassword] = useState("");
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [waitMs, setWaitMs] = useState(0);

  // 审批人2 倒计时（基于审批人1 时间）
  const reviewer1At = action?.reviewer1At ?? null;
  useEffect(() => {
    if (!open) return;
    if (actionKind !== "approve_review2" && actionKind !== "reject_review2") {
      setWaitMs(0);
      return;
    }
    const update = () => setWaitMs(computeReview2WaitMs(reviewer1At));
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [open, actionKind, reviewer1At]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setPassword("");
      setStepUpToken(null);
      setComment("");
      setWaitMs(0);
    }
  }, [open]);

  const isReview2 =
    actionKind === "approve_review2" || actionKind === "reject_review2";
  const isApprove =
    actionKind === "approve_review1" || actionKind === "approve_review2";

  const title = useMemo(() => {
    if (!actionKind) return "双人审批";
    const role = isReview2 ? "审批人2" : "审批人1";
    const action = isApprove ? "通过" : "拒绝";
    return `${role} ${action}`;
  }, [actionKind, isReview2, isApprove]);

  const pendingMutation = (() => {
    switch (actionKind) {
      case "approve_review1":
        return approveReview1;
      case "reject_review1":
        return rejectReview1;
      case "approve_review2":
        return approveReview2;
      case "reject_review2":
        return rejectReview2;
      default:
        return null;
    }
  })();

  const isLoading =
    stepUpMutation.isPending || (pendingMutation?.isPending ?? false);

  const commentTooLong = comment.length > 500;
  const commentValid = comment.trim().length > 0 && !commentTooLong;
  const canSubmit =
    Boolean(stepUpToken) && commentValid && waitMs === 0 && !isLoading;

  /** 申请 stepUpToken */
  const handleStepUp = async () => {
    if (!password) {
      message.warning("请输入当前用户密码");
      return;
    }
    try {
      const resp = await stepUpMutation.mutateAsync({
        currentPassword: password,
        purpose: title,
      });
      setStepUpToken(resp.stepUpToken);
      message.success("二次认证成功");
    } catch {
      message.error("二次认证失败，请检查密码");
    }
  };

  /** 提交审批 */
  const handleSubmit = async () => {
    if (!action || !actionKind || !stepUpToken || !pendingMutation) return;
    if (!commentValid) {
      message.warning("请填写审批意见（1-500 字）");
      return;
    }
    if (waitMs > 0) {
      message.warning(`请等待 ${Math.ceil(waitMs / 1000)} 秒后再提交`);
      return;
    }
    try {
      await pendingMutation.mutateAsync({
        actionId: action.operationId,
        request: { stepUpToken, comment },
      });
      message.success("审批已提交");
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "审批提交失败";
      message.error(msg);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <SafetyCertificateOutlined />
          {title}
        </Space>
      }
      onCancel={onClose}
      onOk={handleSubmit}
      okButtonProps={{ disabled: !canSubmit, danger: !isApprove }}
      okText={isApprove ? "确认通过" : "确认拒绝"}
      cancelText="取消"
      confirmLoading={isLoading}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 操作摘要 */}
        {action && (
          <Alert
            type={isApprove ? "info" : "warning"}
            showIcon
            message={`操作类型: ${action.actionType}`}
            description={`目标对象: ${action.targetId}`}
          />
        )}

        {/* 审批人2 等待提示 */}
        {isReview2 && waitMs > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`请等待 ${Math.ceil(waitMs / 1000)} 秒后再提交`}
            description="为防止快速攻击，审批人2 与审批人1 的审批间隔须 ≥ 5 秒"
          />
        )}

        {/* stepUpToken 二次认证 */}
        {!stepUpToken ? (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              请输入当前用户密码进行二次认证（Step-up）。
            </Paragraph>
            <Input.Password
              placeholder="当前用户密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              onPressEnter={handleStepUp}
            />
            <a onClick={handleStepUp}>点击此处进行二次认证</a>
          </>
        ) : (
          <Alert
            type="success"
            showIcon
            message="二次认证已完成"
            description="stepUpToken 已签发，可继续填写审批意见"
          />
        )}

        {/* 审批意见 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            审批意见（必填，进入审计日志）
          </Text>
          <Input.TextArea
            rows={4}
            placeholder="请详细说明审批意见..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            showCount
          />
          {commentTooLong && (
            <Text type="danger" style={{ fontSize: 11 }}>
              审批意见过长（≤ 500 字）
            </Text>
          )}
        </div>

        {/* 最小间隔说明 */}
        {isReview2 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            最小审批间隔: {DUAL_APPROVAL_MIN_INTERVAL_MS / 1000} 秒
          </Text>
        )}
      </Space>
    </Modal>
  );
}
