"use client";

import { Card, Typography, Space, Tag } from "antd";

const { Title, Paragraph } = Typography;

/**
 * 仪表盘首页
 * V1 技术试点欢迎卡片，展示项目定位与当前阶段
 *
 * "use client"：antd 组件依赖 ConfigProvider 客户端 context，
 * 在 RSC 中直接使用会抛 "Element type is invalid" 异常
 * （与 (auth)/layout.tsx 同类问题）
 */
export default function DashboardPage() {
  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Tag color="blue">V1 技术试点</Tag>
          <Title level={2} style={{ marginTop: 12, marginBottom: 4 }}>
            欢迎使用施工图全流程 AI 平台
          </Title>
          <Paragraph type="secondary">
            建筑专业纵向闭环 — 境外主创草图到方案深化
          </Paragraph>
        </div>
        <Paragraph>
          覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、
          多专业综合校审、发布交付与反馈变更的全流程 AI 辅助平台。
        </Paragraph>
      </Space>
    </Card>
  );
}
