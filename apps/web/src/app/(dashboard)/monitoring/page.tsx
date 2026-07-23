"use client";

import { Card, Col, Row, Statistic, Tag, Descriptions, Typography, Spin, Alert } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useHealth } from "@/hooks/use-monitoring";

const { Title } = Typography;

/** 服务状态卡片 */
function ServiceCard({
  label,
  icon,
  health,
}: {
  label: string;
  icon: React.ReactNode;
  health?: { status: "UP" | "DOWN"; error?: string; details?: Record<string, unknown> };
}) {
  const isUp = health?.status === "UP";
  return (
    <Card size="small" hoverable>
      <Statistic
        title={label}
        value={isUp ? "UP" : "DOWN"}
        prefix={icon}
        valueStyle={{ color: isUp ? "#3f8600" : "#cf1322", fontSize: 20 }}
        suffix={
          isUp ? (
            <CheckCircleOutlined style={{ fontSize: 16 }} />
          ) : (
            <CloseCircleOutlined style={{ fontSize: 16 }} />
          )
        }
      />
      {health?.error && (
        <Tag color="red" style={{ marginTop: 8 }}>
          {health.error}
        </Tag>
      )}
      {health?.details?.durationMs !== undefined && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
          延迟: {health.details.durationMs as number}ms
        </div>
      )}
    </Card>
  );
}

export default function MonitoringPage() {
  const { data: health, isLoading, error } = useHealth();

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载系统状态..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="无法获取系统健康状态"
        description={error instanceof Error ? error.message : "未知错误"}
        showIcon
      />
    );
  }

  const overallUp = health?.status === "UP";

  return (
    <div>
      <Title level={4}>系统监控</Title>

      {/* 整体状态 */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="整体状态">
            <Tag color={overallUp ? "green" : "red"} style={{ fontSize: 14, padding: "2px 12px" }}>
              {overallUp ? "ALL UP" : "DEGRADED"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="检测时间">
            {health?.timestamp ? new Date(health.timestamp).toLocaleString("zh-CN") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="自动刷新">
            <Tag color="blue">30s</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 各服务状态 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <ServiceCard
            label="BFF 服务"
            icon={<DesktopOutlined />}
            health={health?.services.bff}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <ServiceCard
            label="核心服务"
            icon={<CloudServerOutlined />}
            health={health?.services.core}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <ServiceCard
            label="AI 服务"
            icon={<RobotOutlined />}
            health={health?.services.ai}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <ServiceCard
            label="PostgreSQL"
            icon={<DatabaseOutlined />}
            health={health?.services.postgresql}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <ServiceCard
            label="MinIO (S3)"
            icon={<CloudServerOutlined />}
            health={health?.services.minio}
          />
        </Col>
      </Row>
    </div>
  );
}
