"use client";

import { Timeline, Typography, Empty, Spin, Space } from "antd";
import type { DocumentVersionDto } from "@design-platform/shared";
import type { DocumentVersionStatus } from "./document-config";
import { isKnownDocumentVersionStatus } from "./document-config";
import { DocumentVersionStatusBadge } from "./document-badge";

const { Text } = Typography;

/** 版本状态 → Timeline 节点颜色（已兜底） */
function getVersionTimelineColor(
  status: DocumentVersionStatus | string | undefined | null,
): string {
  if (!isKnownDocumentVersionStatus(status)) return "gray";
  switch (status) {
    case "PUBLISHED":
      return "green";
    case "DRAFT":
      return "blue";
    case "SUPERSEDED":
      return "gray";
  }
}

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
export function DocumentVersionHistory({
  versions,
  loading,
}: DocumentVersionHistoryProps) {
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
  const sorted = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );

  return (
    <Timeline
      items={sorted.map((version) => {
        return {
          color: getVersionTimelineColor(version.status),
          children: (
            <Space direction="vertical" size={4}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Text strong>v{version.versionNumber}</Text>
                <DocumentVersionStatusBadge value={version.status} />
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {version.uploadedBy ?? "—"} ·{" "}
                {formatDateTime(version.uploadedAt)}
              </div>
              {version.comment && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {version.comment}
                </Text>
              )}
              {!isKnownDocumentVersionStatus(version.status) &&
                version.status && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    原始状态值：{version.status}
                  </Text>
                )}
            </Space>
          ),
        };
      })}
    />
  );
}
