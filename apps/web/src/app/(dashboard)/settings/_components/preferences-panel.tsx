"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Select,
  Space,
  Switch,
  Typography,
  App,
} from "antd";
import {
  BellOutlined,
  BgColorsOutlined,
  GlobalOutlined,
  ColumnWidthOutlined,
} from "@ant-design/icons";
import type { AuthContext } from "@design-platform/shared";

const { Text } = Typography;

interface PreferencesPanelProps {
  auth?: AuthContext;
}

/**
 * Preferences Tab —— 偏好设置
 *
 * 包含：
 *  - 语言/时区/单位制/币种
 *  - 主题（light/dark/system）
 *  - 通知偏好（邮件/应用内/每日摘要/提及）
 *  - AI 安全偏好（始终显示 AI 辅助标记、人工复核徽章）
 */
export function PreferencesPanel({ auth }: PreferencesPanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await new Promise((r) => setTimeout(r, 600));
      message.success("偏好设置已保存（Mock，未持久化）");
      // eslint-disable-next-line no-console
      console.log("[Preferences] saved (mock):", values);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        language: auth?.principal?.locale ?? "zh-CN",
        timezone: auth?.principal?.timezone ?? "Asia/Shanghai",
        unitSystem: "metric",
        currency: "CNY",
        theme: "light",
        emailNotify: true,
        inAppNotify: true,
        dailyDigest: false,
        mentionNotify: true,
        showAiSafetyBanner: true,
        requireHumanReviewBadge: true,
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 区域与单位 */}
        <Card
          size="small"
          title={
            <>
              <GlobalOutlined style={{ marginRight: 8 }} />
              区域与单位
            </>
          }
        >
          <Form.Item
            name="language"
            label="UI 语言"
            tooltip="影响菜单、按钮和提示文字"
          >
            <Select
              options={[
                { value: "zh-CN", label: "简体中文" },
                { value: "en", label: "English" },
                { value: "en-US", label: "English (US)" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="timezone"
            label="时区"
            tooltip="影响任务到期时间、活动时间展示"
          >
            <Select
              showSearch
              options={[
                { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
                { value: "UTC", label: "UTC" },
                { value: "Europe/London", label: "Europe/London" },
                { value: "America/Los_Angeles", label: "America/Los_Angeles" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="unitSystem"
            label="单位制"
            tooltip="影响图纸尺寸、面积、长度展示"
          >
            <Select
              options={[
                { value: "metric", label: "公制（SI / mm·m·kg）" },
                { value: "imperial", label: "英制（in·ft·lb）" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="currency"
            label="币种"
            tooltip="影响成本、合同金额展示"
          >
            <Select
              options={[
                { value: "CNY", label: "CNY ¥ 人民币" },
                { value: "USD", label: "USD $ 美元" },
                { value: "EUR", label: "EUR € 欧元" },
              ]}
            />
          </Form.Item>
        </Card>

        {/* 外观 */}
        <Card
          size="small"
          title={
            <>
              <BgColorsOutlined style={{ marginRight: 8 }} />
              外观
            </>
          }
        >
          <Form.Item
            name="theme"
            label="主题模式"
            tooltip="跟随系统将根据浏览器 prefers-color-scheme 自动切换"
          >
            <Select
              options={[
                { value: "light", label: "亮色" },
                { value: "dark", label: "暗色" },
                { value: "system", label: "跟随系统" },
              ]}
            />
          </Form.Item>
        </Card>

        {/* 通知偏好 */}
        <Card
          size="small"
          title={
            <>
              <BellOutlined style={{ marginRight: 8 }} />
              通知偏好
            </>
          }
        >
          <Form.Item
            name="emailNotify"
            label="邮件通知"
            valuePropName="checked"
            tooltip="任务指派、审批结果、发布完成等关键事件邮件通知"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="inAppNotify"
            label="应用内通知"
            valuePropName="checked"
            tooltip="右上角铃铛实时通知"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="dailyDigest"
            label="每日摘要"
            valuePropName="checked"
            tooltip="每天 09:00 发送当日待办摘要"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="mentionNotify"
            label="@提及通知"
            valuePropName="checked"
            tooltip="评论/Issue 中被 @ 时立即通知"
          >
            <Switch />
          </Form.Item>
        </Card>

        {/* AI 安全偏好 */}
        <Card
          size="small"
          title={
            <>
              <ColumnWidthOutlined style={{ marginRight: 8 }} />
              AI 安全与可见性偏好
            </>
          }
        >
          <Alert
            type="info"
            showIcon
            message="AI 安全红线（不可关闭核心标记）"
            description="根据 security.md §12 与 design-constraints.md，所有 AI 输出必须标记为'AI 辅助'，且高风险结果必须进入人工复核。以下开关仅影响 UI 提示强度，不影响业务流程。"
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="showAiSafetyBanner"
            label="显示 AI 安全 Banner"
            valuePropName="checked"
            tooltip="在 AI 结果页顶部显示'AI 不替代注册建筑师/工程师专业审签'横幅"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="requireHumanReviewBadge"
            label="高亮显示人工复核徽章"
            valuePropName="checked"
            tooltip="在 AI 输出结果上以醒目标签显示'需人工复核'"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Divider />

        <Space>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存偏好
          </Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>

        <Text type="secondary" style={{ fontSize: 12 }}>
          * V0 阶段所有偏好仅前端 Mock，不持久化；V1 接入 UserPreferences API
          后将按用户存储。
        </Text>
      </Space>
    </Form>
  );
}
