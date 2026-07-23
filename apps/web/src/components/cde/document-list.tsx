"use client";

import { Table, Tag, Typography, Empty } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { DocumentDto, DocumentStatus } from "@design-platform/shared";

const { Text } = Typography;

/** 文档状态 → Tag 颜色映射（参考 cde.contract.ts 状态机） */
const STATUS_TAG_COLOR: Record<DocumentStatus, string> = {
  DRAFT: "default",
  CHECKED_OUT: "processing",
  PUBLISHED: "success",
  SUPERSEDED: "warning",
  ARCHIVED: "default",
};

/** 文档状态 → 展示文本 */
const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  CHECKED_OUT: "Checked Out",
  PUBLISHED: "Published",
  SUPERSEDED: "Superseded",
  ARCHIVED: "Archived",
};

/** 文件大小（字节）→ 人类可读展示 */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
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

/** 从 MIME 类型派生文件类型简称（用于表格展示） */
function mimeToLabel(mime: string): string {
  if (!mime) return "—";
  const lower = mime.toLowerCase();
  if (lower.includes("pdf")) return "PDF";
  if (lower.includes("dwg") || lower.includes("autocad")) return "DWG";
  if (lower.includes("revit") || lower.includes("rvt")) return "RVT";
  if (lower.includes("rhino") || lower.includes("3dm")) return "3DM";
  if (lower.includes("sketchup") || lower.includes("skp")) return "SKP";
  if (lower.includes("rfa")) return "RFA";
  if (lower.includes("dxf")) return "DXF";
  if (lower.includes("zip")) return "ZIP";
  if (lower.includes("octet-stream")) return "BIN";
  return mime;
}

interface DocumentListProps {
  /** 文档列表 */
  documents: DocumentDto[];
  /** 加载态 */
  loading?: boolean;
  /** 分页配置 */
  pagination?: TablePaginationConfig;
  /** 行点击回调（用于打开版本历史） */
  onRowClick?: (document: DocumentDto) => void;
}

/**
 * 文档列表表格
 * - 列：Name / Type / Status / Version / Size / Updated By / Updated At
 * - 状态用 Tag 颜色区分（参考 cde.contract.ts 状态机）
 *
 * 参考 apps/web/src/app/(dashboard)/projects/page.tsx 的 Table 模式
 */
export function DocumentList({
  documents,
  loading,
  pagination,
  onRowClick,
}: DocumentListProps) {
  const columns: ColumnsType<DocumentDto> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Type",
      key: "type",
      width: 100,
      render: (_: unknown, record: DocumentDto) => (
        <Tag>{mimeToLabel(record.mimeType)}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: DocumentStatus) => (
        <Tag color={STATUS_TAG_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "Version",
      dataIndex: "version",
      key: "version",
      width: 100,
      render: (version: number) => <Text code>v{version}</Text>,
    },
    {
      title: "Size",
      dataIndex: "sizeBytes",
      key: "sizeBytes",
      width: 100,
      render: (bytes: number) => formatFileSize(bytes),
    },
    {
      title: "Updated By",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 140,
      ellipsis: true,
      render: (by: string | null) => by ?? "—",
    },
    {
      title: "Updated At",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (iso: string) => formatDateTime(iso),
    },
  ];

  return (
    <Table<DocumentDto>
      rowKey="id"
      columns={columns}
      dataSource={documents}
      loading={loading}
      pagination={pagination}
      scroll={{ x: 960 }}
      locale={{
        emptyText: <Empty description="暂无文档，可点击右上角新建" />,
      }}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record),
        style: { cursor: onRowClick ? "pointer" : "default" },
      })}
    />
  );
}
