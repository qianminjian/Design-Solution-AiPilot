"use client";

import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Alert,
  Divider,
  App,
} from "antd";
import { useState } from "react";
import type { CheckResultDto } from "@design-platform/shared";

const { Title, Paragraph, Text } = Typography;

interface VerifyExceptionFormProps {
  result: CheckResultDto | null;
}

/** 表单值类型（DatePicker 通过 getValueFromEvent 转换为 ISO 字符串） */
interface ExceptionFormValues {
  scope: string;
  basis: string;
  expiryDate?: string;
  compensatingControl: string;
  approverRole: string;
}

/** Exception 草稿（前端态，V0 不提交后端） */
interface ExceptionDraft {
  resultId: string;
  scope: string;
  basis: string;
  expiryDate?: string;
  compensatingControl: string;
  approverRole: string;
}

/** 签审角色选项 */
const APPROVER_ROLE_OPTIONS = [
  { value: "PROJECT_MANAGER", label: "项目经理" },
  { value: "PRINCIPAL_ARCHITECT", label: "主创建筑师" },
  { value: "PRINCIPAL_ENGINEER", label: "主创工程师" },
  { value: "COMPLIANCE_OFFICER", label: "合规负责人" },
  { value: "QA_LEAD", label: "QA 负责人" },
];

/**
 * 验证/例外表单（D37.12 Verify/Exception form）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 主动作：验证结果/创建 Issue/发起 Exception；AI 解释不能改变 Pass/Fail/Unknown
 * - Exception：影响范围、依据、期限、补偿控制、签审角色；审批后结果仍保留原判定并链接例外
 *
 * V0 限制：
 * - Exception 提交后端 API 待 V1 实现，当前仅本地草稿态
 * - Verify 动作需 Issue API 支撑（V1），当前仅展示交互入口
 */
export function VerifyExceptionForm({ result }: VerifyExceptionFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ExceptionFormValues>();
  const [submitted, setSubmitted] = useState(false);

  if (!result) {
    return (
      <Card size="small">
        <Text type="secondary">选择结果后可发起 Exception 草稿</Text>
      </Card>
    );
  }

  // PASS 状态不允许发起 Exception
  if (result.outcome === "PASS") {
    return (
      <Card size="small">
        <Alert
          type="info"
          showIcon
          message="PASS 状态无需发起 Exception"
          description="通过的结果不需要例外申请。如需创建 Issue 跟进改进建议，请使用结果详情中的「创建 Issue」动作。"
        />
      </Card>
    );
  }

  const handleSubmit = (values: ExceptionFormValues) => {
    // V0 阶段：仅本地保存草稿，不调用后端 API
    const draft: ExceptionDraft = {
      resultId: result.id,
      scope: values.scope,
      basis: values.basis,
      expiryDate: values.expiryDate,
      compensatingControl: values.compensatingControl,
      approverRole: values.approverRole,
    };
    // eslint-disable-next-line no-console
    console.info("[VerifyExceptionForm] Exception 草稿已生成", draft);
    message.success("Exception 草稿已生成（V0 仅本地态，V1 将提交后端审批）");
    setSubmitted(true);
    form.resetFields();
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            发起 Exception 草稿
          </Title>
          {submitted && (
            <Text type="success" style={{ fontSize: 12 }}>
              已生成草稿
            </Text>
          )}
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        Exception
        用于在特定条件下豁免某条检查结果的强制整改要求。审批后结果仍保留原判定并链接例外。
      </Paragraph>

      <Divider style={{ margin: "8px 0" }} />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
      >
        <Form.Item
          name="scope"
          label="影响范围"
          rules={[{ required: true, message: "请填写影响范围" }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="如：本项目 1F~3F 防火分区"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="basis"
          label="依据"
          rules={[{ required: true, message: "请填写依据" }]}
        >
          <Input
            placeholder="如 GB 50016-2014 第 5.3.1 条豁免条款"
            maxLength={255}
          />
        </Form.Item>

        <Form.Item
          name="expiryDate"
          label="期限"
          getValueFromEvent={(value) => value?.toISOString?.() ?? undefined}
        >
          <DatePicker
            style={{ width: "100%" }}
            placeholder="选择豁免截止日期"
          />
        </Form.Item>

        <Form.Item
          name="compensatingControl"
          label="补偿控制"
          rules={[{ required: true, message: "请填写补偿控制措施" }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="如：增加巡查频次 / 设置临时防火分隔"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="approverRole"
          label="签审角色"
          rules={[{ required: true, message: "请选择签审角色" }]}
        >
          <Select placeholder="选择签审角色" options={APPROVER_ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              生成草稿
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
