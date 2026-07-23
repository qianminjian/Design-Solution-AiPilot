"use client";

import { Timeline, Tag, Typography, Empty, Spin, Space } from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { DocumentVersionDto, DocumentVersionStatus } from "@design-platform/shared";

const { Text } = Typography;

/** 版本状态 → Tag 颜色 */
const VERSION_STATUS_COLOR: Record<DocumentVersionStatus, string> = {
  DRAFT: "default",
  PUBLISHED: "success",
  SUPERSEDED: "warning",
};

/** 版本状态 → 展示文本 */
const VERSION_STATUS_LABEL: Record<DocumentVersionStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SUPERSEDED: "Superseded",
};

/** 版本状态 → 图标 */
const VERSION_STATUS_ICON: Record<DocumentVersionStatus, React.ElementType> = {
  DRAFT: EditOutlined,
  PUBLISHED: CheckCircleOutlined,
  SUPERSEDED: ClockCircleOutlined,
};

interface DocumentVersionHistoryProps {
  /** 版本列表 */
  versions: DocumentVersionDto[];
  /** 加载态 */
  loading?: boolean;
}

/** ISO 时间 → 本地化展示 */
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

/**
 * 文档版本历史组件
 * - 使用 Ant Design Timeline 展示版本演进
 * - 每个版本节点显示：版本号、状态标签、上传人、上传时间、版本说明
 */
export function DocumentVersionHistory({ versions, loading }: DocumentVersionHistoryProps) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <Spin />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return <Empty description="暂无版本记录" />;
  }

  // 按版本号降序排列（最新在前）
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <Timeline
      items={sorted.map((version) => {
        const Icon = VERSION_STATUS_ICON[version.status];
        return {
          color: version.status === "PUBLISHED"
            ? "green"
            : version.status === "DRAFT"
              ? "blue"
              : "gray",
          children: (
            <Space direction="vertical" size={4}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon />
                <Text strong>v{version.versionNumber}</Text>
                <Tag color={VERSION_STATUS_COLOR[version.status]}>
                  {VERSION_STATUS_LABEL[version.status]}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {version.uploadedBy ?? "—"} · {formatDateTime(version.uploadedAt)}
              </div>
              {version.comment && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {version.comment}
                </Text>
              )}
            </Space>
          ),
        };
      })}
    />
  );
}
