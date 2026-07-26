"use client";

import { Card, Typography, Space, Descriptions } from "antd";
import type { ProjectDto } from "@design-platform/shared";
import { ProjectStatusBadge, BuildingTypeBadge } from "./project-badge";

const { Title, Text } = Typography;

/** ISO 时间 → 本地化展示（undefined / null 显示 —） */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface ProjectHeaderProps {
  /** 项目 DTO */
  project: ProjectDto;
}

/**
 * 项目头部元信息卡片
 * - 顶部：项目名称 + 编码 + 状态徽章
 * - 描述区：建筑类型 / 楼层数 / 地区 / 时间区间
 * - 详情区：Descriptions 展示完整元信息
 *
 * 参考 design-ui-system/pages/project-home.html 的项目头部布局
 */
export function ProjectHeader({ project }: ProjectHeaderProps) {
  const floorsText =
    project.floorsMin === project.floorsMax
      ? String(project.floorsMin)
      : `${project.floorsMin}-${project.floorsMax}`;

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 标题行：名称 + 编码 + 状态 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            {project.name}
          </Title>
          <Text code>{project.code}</Text>
          <ProjectStatusBadge value={project.status} />
        </div>

        {/* 摘要行：建筑类型 / 楼层 / 地区 */}
        <Space size="large" wrap>
          <BuildingTypeBadge value={project.buildingType} />
          <Text type="secondary">{floorsText} floors</Text>
          <Text type="secondary">{project.region || "—"}</Text>
        </Space>

        {/* 完整元信息 */}
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
          bordered
          labelStyle={{ fontWeight: 600, width: 140 }}
        >
          <Descriptions.Item label="GFA (m²)">
            {project.gfa ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Site Area (m²)">
            {project.siteArea ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Language">
            {project.language || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Classification">
            {project.classification || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Started At">
            {formatDateTime(project.startedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Target Completion">
            {formatDateTime(project.targetCompletionAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {formatDateTime(project.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {formatDateTime(project.updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={3}>
            {project.description || "—"}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Card>
  );
}
