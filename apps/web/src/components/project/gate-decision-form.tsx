"use client";

import { useCallback } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  App,
} from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { GateDecision, GateStatus } from "@design-platform/shared";
import type { DecideGateRequest } from "@design-platform/shared";

/** 决策选项 */
const DECISION_OPTIONS: { label: React.ReactNode; value: GateDecision }[] = [
  {
    label: (
      <Space>
        <CheckCircleOutlined style={{ color: "#16a34a" }} />
        <span>Approved</span>
      </Space>
    ),
    value: "approved",
  },
  {
    label: (
      <Space>
        <ExclamationCircleOutlined style={{ color: "#d97706" }} />
        <span>Conditionally Approved</span>
      </Space>
    ),
    value: "conditionally_approved",
  },
  {
    label: (
      <Space>
        <CloseCircleOutlined style={{ color: "#dc2626" }} />
        <span>Rework Required</span>
      </Space>
    ),
    value: "rework_required",
  },
];

interface GateDecisionFormValues {
  decision: GateDecision;
  comment: string;
}

interface GateDecisionFormProps {
  /** 门禁 ID */
  gateId: string;
  /** 门禁名称 */
  gateName: string;
  /** 门禁当前状态 */
  gateStatus: GateStatus;
  /** 提交决策回调 */
  onSubmit: (gateId: string, payload: DecideGateRequest) => Promise<void>;
  /** 提交中 */
  submitting?: boolean;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * 门禁决策表单
 * - 选择决策结论：Approved / Conditionally Approved / Rework Required
 * - 填写决策意见（必填）
 * - 提交后调用 API
 */
export function GateDecisionForm({
  gateId,
  gateName,
  gateStatus,
  onSubmit,
  submitting,
  onCancel,
}: GateDecisionFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<GateDecisionFormValues>();

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(gateId, {
        decision: values.decision,
        comment: values.comment,
      });
      form.resetFields();
      message.success("决策提交成功");
    } catch {
      // 校验失败或提交失败，无需额外处理
    }
  }, [form, gateId, onSubmit, message]);

  // 已决策的门禁不再允许修改
  const isDecided = gateStatus === "decided";

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: "#64748b" }}>
        {gateName} · 状态：{gateStatus === "pending" ? "待决策" : "已决策"}
      </div>

      <Form
        form={form}
        layout="vertical"
        disabled={isDecided}
      >
        <Form.Item
          name="decision"
          label="决策结论"
          rules={[{ required: true, message: "请选择决策结论" }]}
        >
          <Select
            placeholder="选择决策结论"
            options={DECISION_OPTIONS}
            style={{ width: "100%" }}
            aria-label="选择门禁决策结论"
          />
        </Form.Item>

        <Form.Item
          name="comment"
          label="决策意见"
          rules={[{ required: true, message: "请填写决策意见" }]}
        >
          <Input.TextArea
            placeholder="输入决策意见（必填，说明决策理由）"
            rows={3}
            style={{ resize: "none" }}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              onClick={() => void handleSubmit()}
              loading={submitting}
              disabled={isDecided}
            >
              提交决策
            </Button>
            {onCancel && (
              <Button onClick={onCancel}>取消</Button>
            )}
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
