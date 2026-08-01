"use client";

import { Card, Space, Typography } from "antd";
import { ClusterOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

/**
 * Monitoring 页面顶部页头
 */
export function MonitoringHeader() {
  return (
    <Card size="small">
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Title level={4} style={{ margin: 0 }}>
          <ClusterOutlined style={{ marginRight: 8 }} />
          运营中心
        </Title>
        <Text type="secondary">
          Operations（D37.17）· SLO / Queue / Worker / Connector · 实时刷新
        </Text>
      </Space>
    </Card>
  );
}
