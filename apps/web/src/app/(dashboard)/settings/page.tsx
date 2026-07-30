"use client";

import { useState } from "react";
import { Alert, Card, Space, Tabs, Typography } from "antd";
import { SettingOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/use-auth";
import { ProfilePanel } from "./_components/profile-panel";
import { PreferencesPanel } from "./_components/preferences-panel";
import { ApiTokensPanel } from "./_components/api-tokens-panel";
import { DangerZonePanel } from "./_components/danger-zone-panel";

const { Title, Text } = Typography;

/**
 * Settings 页面（D37.17 治理中心对齐）
 *
 * 路由：/settings
 *
 * 包含 4 个 Tab：
 *  - Profile：个人资料（姓名、邮箱、locale、timezone）
 *  - Preferences：偏好设置（语言、时区、单位制、主题、通知）
 *  - API Tokens：API Token 管理（创建/列表/撤销）
 *  - Danger Zone：危险动作（注销账户/撤销所有 Token/退出所有会话）
 *
 * V0 简化：所有写入操作仅本地 Mock，未接入后端 API
 */
export default function SettingsPage() {
  const { data: auth, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8 }} />
            个人设置
          </Title>
          <Text type="secondary">
            Settings（D37.17 治理中心）· Profile / Preferences / API Tokens /
            Danger Zone
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="部分设置项使用 Mock 数据"
        description="V0 阶段 Profile/Preferences/API Tokens 写操作仅前端 Mock，不持久化；V1 接入 IAM/Settings API 后将自动同步。危险动作需 Step-up 重新认证。"
      />

      <Card loading={isLoading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "profile",
              label: "Profile",
              children: <ProfilePanel auth={auth} />,
            },
            {
              key: "preferences",
              label: "Preferences",
              children: <PreferencesPanel auth={auth} />,
            },
            {
              key: "api-tokens",
              label: "API Tokens",
              children: <ApiTokensPanel auth={auth} />,
            },
            {
              key: "danger",
              label: (
                <span style={{ color: "#cf1322" }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  Danger Zone
                </span>
              ),
              children: <DangerZonePanel auth={auth} />,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
