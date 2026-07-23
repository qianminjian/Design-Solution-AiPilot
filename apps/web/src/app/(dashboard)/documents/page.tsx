"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Space, Typography, Empty, App, Spin } from "antd";
import { ArrowRightOutlined, FileTextOutlined } from "@ant-design/icons";
import { useProjects } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api-client";

const { Title, Text } = Typography;

export default function DocumentsIndexPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const { data, isLoading, isError, error } = useProjects({ pageSize: 50 });

  useEffect(() => {
    if (isError && error) {
      const tip =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "文档页面加载失败";
      message.error(tip);
    }
    setLoading(false);
  }, [isError, error, message]);

  const projects = data?.items ?? [];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <FileTextOutlined style={{ fontSize: 24, color: "#2563eb" }} />
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Document Management
          </Title>
          <Text type="secondary">管理项目文档库</Text>
        </div>
      </div>

      <Card>
        <Title level={4} style={{ margin: 0, marginBottom: 16 }}>
          Select a Project
        </Title>

        {loading || isLoading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Spin size="large" />
          </div>
        ) : projects.length === 0 ? (
          <Empty description="暂无项目，请先创建项目" />
        ) : (
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
                onClick={() => router.push(`/projects/${project.id}/documents`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.1)";
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
                    router.push(`/projects/${project.id}/documents`);
                  }}
                >
                  View Documents
                </Button>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
