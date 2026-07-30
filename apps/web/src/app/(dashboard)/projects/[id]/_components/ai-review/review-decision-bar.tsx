"use client";

import { useEffect, useMemo } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  UpOutlined,
} from "@ant-design/icons";
import type {
  AiInvocationRunDto,
  ReviewDecision,
  SubmitReviewDecisionRequest,
} from "@design-platform/shared";
import { useSubmitReviewDecision } from "@/hooks/use-ai-review";

const { Text, Paragraph } = Typography;

/**
 * P09 底部：复核决策栏（含 Checklist + 责任确认）
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13 §主动作「决策」
 *
 * 主动作：
 *  - ACCEPT_AS_DRAFT：接受为草稿（生成 Draft/Proposal）
 *  - EDIT：编辑后接受（生成带编辑痕迹的 Draft）
 *  - REJECT：拒绝（明确原因）
 *  - ESCALATE：上报（升级到更高权限审签）
 *
 * 约束：
 *  - 必须填写 reason
 *  - 必须勾选 checklist（基础项 + 高风险项）
 *  - 必须勾选 responsibilityAcknowledged（AI 不替代专业审签）
 *  - 高风险决策需 stepUpToken
 *  - ACCEPT_AS_DRAFT 必须填写 draftType
 */

const DECISION_LABEL: Record<ReviewDecision, string> = {
  ACCEPT_AS_DRAFT: "接受为草稿",
  EDIT: "编辑后接受",
  REJECT: "拒绝",
  ESCALATE: "上报",
};

const DECISION_COLOR: Record<ReviewDecision, string> = {
  ACCEPT_AS_DRAFT: "success",
  EDIT: "blue",
  REJECT: "error",
  ESCALATE: "warning",
};

const DECISION_ICON: Record<ReviewDecision, React.ReactNode> = {
  ACCEPT_AS_DRAFT: <CheckOutlined />,
  EDIT: <EditOutlined />,
  REJECT: <CloseOutlined />,
  ESCALATE: <ExclamationCircleOutlined />,
};

const DRAFT_TYPE_OPTIONS = [
  { label: "ImpactProposal（影响提案）", value: "ImpactProposal" },
  {
    label: "DesignRevisionDraft（设计修订草稿）",
    value: "DesignRevisionDraft",
  },
  { label: "ComplianceAnnotation（合规标注）", value: "ComplianceAnnotation" },
];

/** 默认检查清单项（D37.13 §决策「必须 checklist」） */
const DEFAULT_CHECKLIST_ITEMS = [
  {
    item: "已核对输入数据版本与来源",
    required: true,
    highRisk: false,
  },
  {
    item: "已审阅输出 Diff 与字段级变更",
    required: true,
    highRisk: false,
  },
  {
    item: "已核验引用证据的相关性与可信度",
    required: true,
    highRisk: false,
  },
  {
    item: "已确认输出符合业务规则与规范要求",
    required: true,
    highRisk: false,
  },
  {
    item: "已确认输出符合设计意图与上下文",
    required: true,
    highRisk: false,
  },
];

/** 高风险额外检查清单项 */
const HIGH_RISK_CHECKLIST_ITEMS = [
  {
    item: "已与注册建筑师/工程师复核结构、合规等高风险结论",
    required: true,
    highRisk: true,
  },
  {
    item: "已确认输出仅作为 Draft/Proposal，不直接进入业务状态",
    required: true,
    highRisk: true,
  },
];

export interface ReviewDecisionBarProps {
  /** 当前 Run */
  run: AiInvocationRunDto;
  /** 是否展开决策面板 */
  open: boolean;
  /** 打开决策面板 */
  onOpen: () => void;
  /** 关闭决策面板 */
  onClose: () => void;
}

export function ReviewDecisionBar({
  run,
  open,
  onOpen,
  onClose,
}: ReviewDecisionBarProps) {
  const [form] = Form.useForm();
  const submitMutation = useSubmitReviewDecision();
  const isHighRisk = run.riskLevel === "HIGH" || run.riskLevel === "CRITICAL";

  // 高风险项合并
  const checklistItems = useMemo(() => {
    const base = [...DEFAULT_CHECKLIST_ITEMS];
    if (isHighRisk) {
      return [...base, ...HIGH_RISK_CHECKLIST_ITEMS];
    }
    return base;
  }, [isHighRisk]);

  // 决策变化时重置表单
  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  // 提交决策
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const decision = values.decision as ReviewDecision;

      // 构造 checklist
      const checklist = checklistItems.map((item) => ({
        item: item.item,
        passed: values[`checklist_${item.item}`] ?? false,
      }));

      const request: SubmitReviewDecisionRequest = {
        runId: run.id,
        decision,
        reason: values.reason as string,
        checklist,
        draftType:
          decision === "ACCEPT_AS_DRAFT"
            ? (values.draftType as string)
            : undefined,
        isBlindReview: values.isBlindReview ?? false,
        responsibilityAcknowledged: values.responsibilityAcknowledged ?? false,
        targetETag: run.targetETag ?? undefined,
        stepUpToken: isHighRisk ? (values.stepUpToken as string) : undefined,
      };

      await submitMutation.mutateAsync(request);
      onClose();
    } catch (err) {
      // 表单校验失败或提交错误
      void err;
    }
  };

  // 折叠状态下的决策按钮
  return (
    <div
      style={{
        marginTop: 12,
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e8e8e8",
        overflow: "hidden",
      }}
    >
      {/* 头部条 */}
      <div
        style={{
          padding: "10px 16px",
          background: isHighRisk ? "#fff2e8" : "#fafafa",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Space size={8}>
          <SafetyCertificateOutlined style={{ color: "#fa8c16" }} />
          <Text strong style={{ fontSize: 13 }}>
            等待人工复核决策
          </Text>
          <Tag color="orange" style={{ fontSize: 10 }}>
            {run.riskLevel}
          </Tag>
          {isHighRisk && (
            <Tag color="red" style={{ fontSize: 10 }}>
              高风险需 stepUpToken
            </Tag>
          )}
        </Space>
        <Button type="primary" icon={<UpOutlined />} onClick={onOpen}>
          展开决策面板
        </Button>
      </div>

      {/* 决策面板 */}
      <Drawer
        title="AI 复核决策"
        placement="bottom"
        open={open}
        onClose={onClose}
        height={isHighRisk ? "70vh" : "60vh"}
        extra={
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={submitMutation.isPending}
              onClick={handleSubmit}
            >
              提交决策
            </Button>
          </Space>
        }
      >
        {/* AI 安全声明 */}
        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="AI 输出声明"
          description={
            <span style={{ fontSize: 12 }}>
              本 Run 输出标记为
              <Tag color="blue" style={{ marginLeft: 4 }}>
                AI 辅助
              </Tag>
              ，<Text strong>不替代注册建筑师/工程师的专业审签和监管审批</Text>
              。{isHighRisk && " 高风险输出只允许形成 Proposal/草稿。"}
            </span>
          }
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical" requiredMark="optional">
          {/* 决策动作 */}
          <Form.Item
            name="decision"
            label="复核决策"
            rules={[{ required: true, message: "请选择决策动作" }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {(Object.keys(DECISION_LABEL) as ReviewDecision[]).map((d) => (
                  <Radio key={d} value={d}>
                    <Space size={4}>
                      {DECISION_ICON[d]}
                      <Text strong>{DECISION_LABEL[d]}</Text>
                      <Tag
                        color={DECISION_COLOR[d]}
                        style={{ fontSize: 10, marginLeft: 4 }}
                      >
                        {d}
                      </Tag>
                    </Space>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* ACCEPT_AS_DRAFT 时显示 draftType */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.decision !== curr.decision}
          >
            {({ getFieldValue }) =>
              getFieldValue("decision") === "ACCEPT_AS_DRAFT" ? (
                <Form.Item
                  name="draftType"
                  label="草稿类型"
                  rules={[{ required: true, message: "请选择草稿类型" }]}
                  tooltip="对齐 D37.13 §主动作：ACCEPT_AS_DRAFT 必须指定 draftType"
                >
                  <Select
                    placeholder="选择草稿类型"
                    options={DRAFT_TYPE_OPTIONS}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          {/* 决策原因 */}
          <Form.Item
            name="reason"
            label="决策原因"
            rules={[
              { required: true, message: "请填写决策原因（必填）" },
              { min: 10, message: "原因至少 10 字" },
              { max: 1000, message: "原因不超过 1000 字" },
            ]}
            tooltip="对齐 D37.13 §决策：所有决策必须填写 reason，便于追溯审计"
          >
            <Input.TextArea
              rows={4}
              placeholder="请说明决策原因，例如：已核对规范条款 GB 50016 §5.5.17，输出符合疏散距离要求..."
              maxLength={1000}
              showCount
            />
          </Form.Item>

          {/* 检查清单 */}
          <Form.Item label="复核检查清单">
            <Paragraph
              type="secondary"
              style={{ fontSize: 11, marginBottom: 8 }}
            >
              <ExclamationCircleOutlined /> 必须勾选全部检查项方可提交（对齐
              D37.13 §决策「必须 checklist」）。
              {isHighRisk && " 高风险项已用红色标记。"}
            </Paragraph>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {checklistItems.map((item) => (
                <Form.Item
                  key={item.item}
                  name={`checklist_${item.item}`}
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value
                          ? Promise.resolve()
                          : Promise.reject(new Error(`必须勾选：${item.item}`)),
                    },
                  ]}
                >
                  <Checkbox>
                    <Text
                      style={{
                        fontSize: 12,
                        color: item.highRisk ? "#ff4d4f" : "inherit",
                      }}
                    >
                      {item.highRisk && (
                        <Tag
                          color="red"
                          style={{ fontSize: 10, marginRight: 4 }}
                        >
                          高风险
                        </Tag>
                      )}
                      {item.item}
                    </Text>
                  </Checkbox>
                </Form.Item>
              ))}
            </Space>
          </Form.Item>

          {/* 高风险决策需 stepUpToken */}
          {isHighRisk && (
            <Form.Item
              name="stepUpToken"
              label="Step-up Token"
              rules={[
                { required: true, message: "高风险决策需输入 stepUpToken" },
              ]}
              tooltip="高风险决策需二次认证（V0 占位：实际由 BFF 校验）"
            >
              <Input.Password placeholder="请输入 step-up token" />
            </Form.Item>
          )}

          {/* 盲审选项 */}
          <Form.Item
            name="isBlindReview"
            valuePropName="checked"
            tooltip="勾选后表示在查看 AI 建议前已做独立判断"
          >
            <Checkbox>本决策为盲审（隐藏 AI 建议先做独立判断）</Checkbox>
          </Form.Item>

          {/* 责任确认 */}
          <Form.Item
            name="responsibilityAcknowledged"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error("必须勾选责任确认：AI 不替代专业审签"),
                      ),
              },
            ]}
          >
            <Checkbox>
              <Text strong style={{ color: "#fa541c" }}>
                <SafetyCertificateOutlined /> 我确认：AI 输出仅作为辅助参考，
                不替代注册建筑师/工程师的专业审签和监管审批。
              </Text>
            </Checkbox>
          </Form.Item>

          {/* 目标 ETag 提示 */}
          {run.targetETag && (
            <Alert
              type="info"
              showIcon
              icon={<CheckOutlined />}
              style={{ marginTop: 8 }}
              message={
                <span style={{ fontSize: 12 }}>
                  目标 ETag：
                  <Text code style={{ fontSize: 10, marginLeft: 4 }}>
                    {run.targetETag}
                  </Text>
                </span>
              }
              description="Accept 时将基于此 ETag 进行乐观锁校验，确保并发安全。"
            />
          )}
        </Form>
      </Drawer>
    </div>
  );
}
