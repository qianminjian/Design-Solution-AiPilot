"use client";

import { Button, Card, Space, Typography } from "antd";

const { Title, Paragraph } = Typography;

export default function HomePage() {
  return (
    <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Title level={2}>施工图全流程 AI 平台</Title>
          <Paragraph type="secondary">
            V1 技术试点 — 建筑专业纵向闭环
          </Paragraph>
          <Paragraph>
            覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、
            多专业综合校审、发布交付与反馈变更的全流程 AI 辅助平台。
          </Paragraph>
          <Button type="primary" disabled>
            项目列表（建设中）
          </Button>
        </Space>
      </Card>
    </div>
  );
}
