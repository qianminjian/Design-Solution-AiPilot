"use client";

import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";
import type {
  CreateWaiverRequest,
  ReviewWaiverRequest,
  WaiverDto,
  WaiverStatus,
} from "@design-platform/shared";
import { useCreateWaiver, useReviewWaiver } from "@/hooks/use-coordination";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

/**
 * P07 协调工作台 WaiverPanel 豁免管理面板
 * 对齐 D37.11 §关闭/豁免「Waiver 显示范围/期限/批准人，过期自动回待审」
 *
 * 功能：
 *  - 申请豁免（创建）：范围/理由/期限/补偿控制/签审角色
 *  - 审核豁免（Approve/Reject）：审核人 + 原因
 *  - 显示豁免详情：状态、过期判断、签审链
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险动作须 stepUpToken（V0 占位）
 *  - 所有 Waiver 操作进入审计日志
 */

const APPROVAL_ROLE_OPTIONS = [
  { value: "PRINCIPAL_ENGINEER", label: "Principal Engineer（注册工程师）" },
  {
    value: "FIRE_SAFETY_REVIEWER",
    label: "Fire Safety Reviewer（消防安全审核）",
  },
  { value: "STRUCTURAL_ENGINEER", label: "Structural Engineer（结构工程师）" },
  { value: "MEP_COORDINATOR", label: "MEP Coordinator（机电协调员）" },
  { value: "PROJECT_MANAGER", label: "Project Manager（项目经理）" },
];

const WAIVER_STATUS_COLOR: Record<WaiverStatus, string> = {
  PENDING: "processing",
  APPROVED: "success",
  REJECTED: "error",
  EXPIRED: "warning",
  REVOKED: "default",
};

const WAIVER_STATUS_LABEL: Record<WaiverStatus, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  EXPIRED: "已过期",
  REVOKED: "已撤销",
};

interface WaiverCreateModalProps {
  open: boolean;
  issueId: string | null;
  onClose: () => void;
  onSuccess?: (waiver: WaiverDto) => void;
}

/**
 * 创建豁免模态框
 */
export function WaiverCreateModal({
  open,
  issueId,
  onClose,
  onSuccess,
}: WaiverCreateModalProps) {
  const [form] = Form.useForm<
    CreateWaiverRequest & { dateRange: [string, string] }
  >();
  const createMutation = useCreateWaiver();

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async () => {
    if (!issueId) {
      void message.error("缺少 Issue ID");
      return;
    }
    try {
      const values = await form.validateFields();
      const payload: CreateWaiverRequest = {
        issueId,
        scope: values.scope,
        justification: values.justification,
        expiresAt: values.expiresAt,
        compensatingControl: values.compensatingControl,
        approvalRole: values.approvalRole,
      };
      const waiver = await createMutation.mutateAsync(payload);
      void message.success("豁免申请已提交");
      onSuccess?.(waiver);
      onClose();
    } catch (err) {
      // validateFields 失败不弹错误，由 Form 自身显示
      if (err && typeof err === "object" && "errorFields" in err) {
        return;
      }
      void message.error("提交失败，请稍后重试");
    }
  };

  return (
    <Modal
      title="申请豁免"
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createMutation.isPending}
          onClick={handleSubmit}
        >
          提交申请
        </Button>,
      ]}
    >
      <Alert
        type="warning"
        showIcon
        message="豁免申请须符合设计规范或设计决策依据"
        description="提交后将进入签审角色审批流程；批准后将在到期日自动回待审。"
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" requiredMark preserve={false}>
        <Form.Item
          name="scope"
          label="豁免范围"
          rules={[
            { required: true, message: "请输入豁免范围" },
            { max: 500, message: "不超过 500 字符" },
          ]}
          tooltip="影响的设计元素/区域，如 '2F 东侧防火分区疏散距离'"
        >
          <TextArea rows={2} placeholder="影响范围描述" />
        </Form.Item>

        <Form.Item
          name="justification"
          label="豁免依据"
          rules={[
            { required: true, message: "请输入豁免依据" },
            { max: 1000, message: "不超过 1000 字符" },
          ]}
          tooltip="依据规范条文或设计决策"
        >
          <TextArea rows={3} placeholder="如 GB 50016-2014 §5.5.17 例外条款" />
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="豁免期限"
          rules={[{ required: true, message: "请选择豁免期限" }]}
        >
          <RangePicker
            showTime
            style={{ width: "100%" }}
            placeholder={["生效时间", "到期时间"]}
            onChange={(_, dateStrings) => {
              if (dateStrings[0] && dateStrings[1]) {
                form.setFieldValue("expiresAt", dateStrings[1]);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          name="expiresAt"
          hidden
          rules={[{ required: true, message: "请选择到期时间" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="compensatingControl"
          label="补偿控制"
          tooltip="替代措施，确保安全/合规不受影响"
        >
          <TextArea rows={2} placeholder="如 增设临时消防巡视 / 限制使用荷载" />
        </Form.Item>

        <Form.Item
          name="approvalRole"
          label="签审角色"
          rules={[{ required: true, message: "请选择签审角色" }]}
        >
          <Select
            options={APPROVAL_ROLE_OPTIONS}
            placeholder="选择负责审批的角色"
          />
        </Form.Item>
      </Form>

      {createMutation.isError && (
        <Alert
          type="error"
          showIcon
          message="提交失败"
          description={(createMutation.error as Error)?.message ?? "请稍后重试"}
          style={{ marginTop: 12 }}
        />
      )}
    </Modal>
  );
}

interface WaiverReviewModalProps {
  open: boolean;
  waiver: WaiverDto | null;
  onClose: () => void;
  onSuccess?: (waiver: WaiverDto) => void;
}

/**
 * 审核豁免模态框
 */
export function WaiverReviewModal({
  open,
  waiver,
  onClose,
  onSuccess,
}: WaiverReviewModalProps) {
  const [action, setAction] = useState<ReviewWaiverRequest["action"] | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const reviewMutation = useReviewWaiver();

  useEffect(() => {
    if (open) {
      setAction(null);
      setReason("");
    }
  }, [open]);

  if (!waiver) {
    return null;
  }

  const handleSubmit = async () => {
    if (!action) {
      void message.warning("请选择 Approve 或 Reject");
      return;
    }
    try {
      const updated = await reviewMutation.mutateAsync({
        waiverId: waiver.id,
        action,
        reason: reason.trim() || undefined,
      });
      void message.success(action === "APPROVE" ? "豁免已批准" : "豁免已拒绝");
      onSuccess?.(updated);
      onClose();
    } catch {
      void message.error("审核失败，请稍后重试");
    }
  };

  const isExpired =
    waiver.status === "EXPIRED" ||
    (new Date(waiver.expiresAt).getTime() < Date.now() &&
      waiver.status === "APPROVED");

  return (
    <Modal
      title="审核豁免申请"
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="reject"
          danger
          loading={reviewMutation.isPending}
          onClick={() => {
            setAction("REJECT");
            void handleSubmit();
          }}
        >
          拒绝
        </Button>,
        <Button
          key="approve"
          type="primary"
          loading={reviewMutation.isPending}
          onClick={() => {
            setAction("APPROVE");
            void handleSubmit();
          }}
        >
          批准
        </Button>,
      ]}
    >
      <Paragraph>
        <Text strong>豁免范围：</Text>
        <br />
        {waiver.scope}
      </Paragraph>
      <Paragraph>
        <Text strong>豁免依据：</Text>
        <br />
        {waiver.justification}
      </Paragraph>
      <Paragraph>
        <Text strong>到期时间：</Text>{" "}
        <Tag color={isExpired ? "warning" : "blue"}>
          {new Date(waiver.expiresAt).toLocaleString("zh-CN")}
        </Tag>
        {isExpired && (
          <Tag color="warning" style={{ marginLeft: 4 }}>
            已过期
          </Tag>
        )}
      </Paragraph>
      {waiver.compensatingControl && (
        <Paragraph>
          <Text strong>补偿控制：</Text>
          <br />
          {waiver.compensatingControl}
        </Paragraph>
      )}
      <Paragraph>
        <Text strong>签审角色：</Text> {waiver.approvalRole}
      </Paragraph>
      <Paragraph>
        <Text strong>当前状态：</Text>{" "}
        <Tag color={WAIVER_STATUS_COLOR[waiver.status]}>
          {WAIVER_STATUS_LABEL[waiver.status]}
        </Tag>
      </Paragraph>

      <Form.Item label="审核原因（可选）">
        <TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="审核备注，将记录在审计日志中"
          maxLength={500}
          showCount
        />
      </Form.Item>

      {reviewMutation.isError && (
        <Alert
          type="error"
          showIcon
          message="审核失败"
          description={(reviewMutation.error as Error)?.message ?? "请稍后重试"}
          style={{ marginTop: 12 }}
        />
      )}
    </Modal>
  );
}

/**
 * WaiverPanel：作为统一入口，可同时管理创建+审核
 */
interface WaiverPanelProps {
  /** 当前选中的 Issue ID */
  issueId: string | null;
  /** 待审核的 Waiver（如未传入，则隐藏审核入口） */
  waiverForReview?: WaiverDto | null;
  /** 是否自动打开创建模态框 */
  createOpen: boolean;
  /** 是否自动打开审核模态框 */
  reviewOpen: boolean;
  onCreateClose: () => void;
  onReviewClose: () => void;
  onCreateSuccess?: (waiver: WaiverDto) => void;
  onReviewSuccess?: (waiver: WaiverDto) => void;
}

export function WaiverPanel({
  issueId,
  waiverForReview,
  createOpen,
  reviewOpen,
  onCreateClose,
  onReviewClose,
  onCreateSuccess,
  onReviewSuccess,
}: WaiverPanelProps) {
  return (
    <>
      <WaiverCreateModal
        open={createOpen}
        issueId={issueId}
        onClose={onCreateClose}
        onSuccess={onCreateSuccess}
      />
      <WaiverReviewModal
        open={reviewOpen}
        waiver={waiverForReview ?? null}
        onClose={onReviewClose}
        onSuccess={onReviewSuccess}
      />
    </>
  );
}
