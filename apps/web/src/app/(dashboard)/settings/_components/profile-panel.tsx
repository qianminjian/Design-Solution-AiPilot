"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Typography,
  App,
} from "antd";
import { UserOutlined, MailOutlined, KeyOutlined } from "@ant-design/icons";
import type { AuthContext } from "@design-platform/shared";

const { Text } = Typography;

interface ProfilePanelProps {
  auth?: AuthContext;
}

/**
 * Profile Tab —— 个人资料
 *
 * 包含：
 *  - 基本信息展示（ID/Tenant/Type/Status，只读）
 *  - 可编辑字段（displayName/locale/timezone）
 *  - 修改密码区块
 *
 * V0：写入操作仅 Mock，调用 message.success 提示，不持久化
 */
export function ProfilePanel({ auth }: ProfilePanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const principal = auth?.principal;
  const tenant = auth?.tenant;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      // V0：Mock 延迟
      await new Promise((r) => setTimeout(r, 600));
      message.success(
        `已保存（Mock，未持久化）：${values.displayName ?? principal?.displayName ?? ""}`,
      );
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      await pwdForm.validateFields();
      setPwdSaving(true);
      await new Promise((r) => setTimeout(r, 600));
      message.success("密码已更新（Mock，未持久化）");
      pwdForm.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "密码修改失败");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card
        size="small"
        title={
          <>
            <UserOutlined style={{ marginRight: 8 }} />
            基本信息（只读）
          </>
        }
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Principal ID">
            <Text code>{principal?.id ?? "—"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <Text>{principal?.type ?? "—"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tenant">
            <Space size={4}>
              <Text code>{tenant?.code ?? tenant?.id ?? "—"}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {tenant?.name ?? ""}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Text>{principal?.status ?? "—"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Email" span={2}>
            <Space size={4}>
              <MailOutlined />
              <Text>{principal?.email ?? "—"}</Text>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={
          <>
            <UserOutlined style={{ marginRight: 8 }} />
            可编辑字段
          </>
        }
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            displayName: principal?.displayName ?? "",
            locale: principal?.locale ?? "en",
            timezone: principal?.timezone ?? "UTC",
          }}
        >
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[
              { required: true, message: "请输入显示名称" },
              { min: 2, message: "至少 2 个字符" },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="如 张工 / Zhang" />
          </Form.Item>
          <Form.Item
            name="locale"
            label="首选语言"
            tooltip="影响 UI 语言和邮件通知语言"
          >
            <Input placeholder="如 zh-CN / en" />
          </Form.Item>
          <Form.Item
            name="timezone"
            label="时区"
            tooltip="影响任务到期时间展示"
          >
            <Input placeholder="如 Asia/Shanghai / UTC" />
          </Form.Item>
        </Form>
      </Card>

      <Card
        size="small"
        title={
          <>
            <KeyOutlined style={{ marginRight: 8 }} />
            修改密码
          </>
        }
        extra={
          <Button loading={pwdSaving} onClick={handleChangePassword}>
            更新密码
          </Button>
        }
      >
        <Alert
          type="warning"
          showIcon
          message="密码安全策略"
          description="密码需 ≥ 12 位，包含大小写字母、数字和符号；90 天后强制轮换；最近 5 次密码不可复用。"
          style={{ marginBottom: 16 }}
        />
        <Form form={pwdForm} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password placeholder="当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 12, message: "至少 12 位" },
            ]}
          >
            <Input.Password placeholder="新密码（≥12 位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Card>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V0 阶段所有写操作仅 Mock，不调用后端 API；V1 接入 IAM Service
        后将持久化并触发审计日志。
      </Text>
    </Space>
  );
}
