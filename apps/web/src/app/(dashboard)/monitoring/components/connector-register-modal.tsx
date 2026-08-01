"use client";

import { Alert, Form, Input, Modal, Select, Space, Switch, Tag } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import type {
  ConnectorStatusDto,
  ConnectorType,
  ConnectorRegisterRequest,
} from "@design-platform/shared";
import { CONNECTOR_TYPE_LABEL } from "@design-platform/shared";
import type { FormInstance } from "antd";
import type { UseMutationResult } from "@tanstack/react-query";

/**
 * Connector 注册模态框（V1.10.3）
 *
 * 对齐后端 POST /api/v1/operations/connectors/register（幂等注册）
 *
 * 安全红线（OD-05 外部 AI V1 约束）：
 *  - AI_PROVIDER 类型后端会强制 isManualHandoff=true
 *  - 前端表单展示提示，但不阻止用户提交（最终校验由后端完成）
 *  - 同一 connectorCode 已存在时更新记录（幂等注册）
 */
export interface ConnectorRegisterModalProps {
  open: boolean;
  onClose: () => void;
  form: FormInstance<{
    connectorCode: string;
    name: string;
    type: ConnectorType;
    region?: string;
    endpointUrl?: string;
    licenseRemaining?: string;
    isManualHandoff: boolean;
  }>;
  onSubmit: () => void;
  registerMutation: UseMutationResult<
    ConnectorStatusDto,
    Error,
    ConnectorRegisterRequest,
    unknown
  >;
}

export function ConnectorRegisterModal({
  open,
  onClose,
  form,
  onSubmit,
  registerMutation,
}: ConnectorRegisterModalProps) {
  return (
    <Modal
      title={
        <Space>
          <ApiOutlined />
          <span>注册新连接器</span>
          <Tag color="blue" style={{ fontSize: 11 }}>
            V1.10.3 幂等注册
          </Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={registerMutation.isPending}
      okText="提交注册"
      cancelText="取消"
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: "llm", isManualHandoff: false }}
      >
        <Form.Item
          name="connectorCode"
          label="连接器编号"
          rules={[
            { required: true, message: "请输入连接器编号" },
            {
              max: 128,
              message: "编号长度不能超过 128 字符",
            },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: "仅允许字母、数字、下划线、连字符",
            },
          ]}
          tooltip="连接器业务编号，如 deepseek-llm-001；同一编号重复调用将更新记录（幂等）"
        >
          <Input placeholder="例如：deepseek-llm-001" />
        </Form.Item>
        <Form.Item
          name="name"
          label="连接器名称"
          rules={[
            { required: true, message: "请输入连接器名称" },
            { max: 200, message: "名称长度不能超过 200 字符" },
          ]}
        >
          <Input placeholder="例如：DeepSeek LLM 连接器" />
        </Form.Item>
        <Form.Item
          name="type"
          label="连接器类型"
          rules={[{ required: true, message: "请选择连接器类型" }]}
          tooltip="OD-05：AI_PROVIDER 类型会强制 isManualHandoff=true（V1 不自动接入建筑 AI Provider）"
        >
          <Select
            options={[
              { value: "llm", label: CONNECTOR_TYPE_LABEL.llm },
              { value: "ai_provider", label: CONNECTOR_TYPE_LABEL.ai_provider },
              { value: "minio", label: CONNECTOR_TYPE_LABEL.minio },
              { value: "revit", label: CONNECTOR_TYPE_LABEL.revit },
              { value: "rhino", label: CONNECTOR_TYPE_LABEL.rhino },
              { value: "sketchup", label: CONNECTOR_TYPE_LABEL.sketchup },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="region"
          label="部署 Region"
          rules={[{ max: 64, message: "Region 长度不能超过 64 字符" }]}
          tooltip="Hybrid-Site 部署标识（如 cn-east-1），未来 V1 可扩展校验 region 与租户配置一致性"
        >
          <Input placeholder="例如：cn-east-1（可选）" />
        </Form.Item>
        <Form.Item
          name="endpointUrl"
          label="端点 URL"
          rules={[{ max: 500, message: "URL 长度不能超过 500 字符" }]}
        >
          <Input placeholder="例如：https://api.deepseek.com（可选）" />
        </Form.Item>
        <Form.Item
          name="licenseRemaining"
          label="许可证剩余描述"
          rules={[{ max: 200, message: "描述长度不能超过 200 字符" }]}
        >
          <Input placeholder="例如：5000 calls / 30 days（可选）" />
        </Form.Item>
        <Form.Item
          name="isManualHandoff"
          label="是否 ManualHandoff"
          valuePropName="checked"
          tooltip="OD-05 外部 AI V1 约束：AI_PROVIDER 类型后端会强制覆盖为 true，其他类型按此字段设置"
        >
          <Switch
            checkedChildren="ManualHandoff"
            unCheckedChildren="自动接入"
          />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          message="安全红线说明（OD-05）"
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
              <li>
                AI_PROVIDER 类型（建筑 AI Provider）后端强制
                isManualHandoff=true
              </li>
              <li>同一 connectorCode 已存在时更新记录（幂等注册）</li>
            </ul>
          }
          style={{ marginTop: 8 }}
        />
      </Form>
    </Modal>
  );
}
