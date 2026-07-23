"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Checkbox, Typography, App } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import type { LoginRequest } from "@design-platform/shared";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 登录表单字段值 */
interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * 登录表单
 * - 邮箱 + 密码 + 记住我
 * - 调用 useLogin() mutation，成功后跳转 /dashboard
 * - 失败时通过 App.useApp().message 显示错误信息
 */
export function LoginForm() {
  const router = useRouter();
  const { message } = App.useApp();
  const loginMutation = useLogin();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const payload: LoginRequest = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        rememberMe: values.rememberMe,
      };
      await loginMutation.mutateAsync(payload);
      message.success("登录成功");
      router.push("/dashboard");
    } catch (error) {
      // ApiError 携带业务错误码与可读 title，优先展示
      if (error instanceof ApiError) {
        message.error(error.message || "登录失败，请检查邮箱与密码");
      } else if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error("登录失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      style={{
        width: 420,
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
      }}
      bordered={false}
    >
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Sign In
        </Title>
        <Text type="secondary">使用企业邮箱登录平台</Text>
      </div>
      <Form<LoginFormValues>
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ rememberMe: false }}
        autoComplete="on"
      >
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: "请输入邮箱" },
            { type: "email", message: "邮箱格式不正确" },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="name@example.com"
            autoComplete="email"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="密码"
          name="password"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 8, message: "密码至少 8 个字符" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="至少 8 个字符"
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item name="rememberMe" valuePropName="checked">
          <Checkbox>记住此设备</Checkbox>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={submitting || loginMutation.isPending}
          >
            Sign In
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
