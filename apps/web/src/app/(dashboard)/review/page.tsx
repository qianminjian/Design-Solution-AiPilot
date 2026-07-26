"use client";

import { useRouter } from "next/navigation";
import { Card, Button, Space, Typography, Empty, Spin } from "antd";
import { ArrowRightOutlined, CheckSquareOutlined } from "@ant-design/icons";
import { useProjects } from "@/hooks/use-projects";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

export default function ReviewIndexPage() {
  const router = useRouter();

  const { data, isLoading, isError, error } = useProjects({ pageSize: 50 });

  const projects = data?.items ?? [];

  // 列表区域：加载/错误/数据三态
  // schema 校验失败或网络错误时用 DataErrorAlert 内联展示，替代 message.error() toast
  const listRegion = (() => {
    if (isLoading) {
      return (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Spin size="large" />
        </div>
      );
    }
    if (isError) {
      return <DataErrorAlert error={error} context="审核项目列表" />;
    }
    if (projects.length === 0) {
      return <Empty description="暂无项目，请先创建项目" />;
    }
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {projects.map((project) => (
          <div
            key={project.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              backgroundColor: "#ffffff",
              cursor: "pointer",
              transition: "all 200ms",
            }}
            onClick={() => router.push(`/review/${project.id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(37, 99, 235, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div>
              <Text strong>{project.name}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {project.code}
              </Text>
            </div>
            <Button
              type="link"
              icon={<ArrowRightOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/review/${project.id}`);
              }}
            >
              Start Review
            </Button>
          </div>
        ))}
      </Space>
    );
  })();

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <CheckSquareOutlined style={{ fontSize: 24, color: "#2563eb" }} />
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Design Review
          </Title>
          <Text type="secondary">AI 辅助设计合规性与质量审核</Text>
        </div>
      </div>

      <Card>
        <Title level={4} style={{ margin: 0, marginBottom: 16 }}>
          Select a Project
        </Title>
        {listRegion}
      </Card>
    </Space>
  );
}
