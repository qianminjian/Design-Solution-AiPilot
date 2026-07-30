"use client";

import { Card, Empty, Spin, Tag, Typography, Tree, Alert } from "antd";
import {
  FileTextOutlined,
  BookOutlined,
  ContainerOutlined,
  NotificationOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import type {
  RequirementSourceDto,
  RequirementSourceType,
} from "@design-platform/shared";
import { ApiError } from "@/lib/api-client";

const { Text } = Typography;

/** 来源类型图标与标签 */
const SOURCE_TYPE_META: Record<
  RequirementSourceType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  BRIEF: {
    label: "Brief",
    icon: <FileTextOutlined />,
    color: "#2563eb",
  },
  CODE: { label: "Code", icon: <BookOutlined />, color: "#0891b2" },
  CONTRACT: {
    label: "Contract",
    icon: <ContainerOutlined />,
    color: "#7c3aed",
  },
  ADDENDUM: {
    label: "Addendum",
    icon: <NotificationOutlined />,
    color: "#d97706",
  },
  OTHER: {
    label: "Other",
    icon: <InboxOutlined />,
    color: "#64748b",
  },
};

/** 判断是否为后端未实现错误 */
function isNotImplementedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 501;
  }
  return false;
}

interface SourceTreePanelProps {
  sources: RequirementSourceDto[];
  loading: boolean;
  error: unknown;
  onSelectSource: (sourceId: string) => void;
}

/**
 * D37.7 P03 左侧来源树
 *
 * 展示需求来源（业主任务书 / 规范 / 合同附件等）的分组树，
 * 点击来源项可过滤对应需求。
 *
 * 空状态（对齐 D37.7 §空状态红线）：
 *  - 无来源时显示"导入来源"引导，不伪造数据
 */
export function SourceTreePanel({
  sources,
  loading,
  error,
  onSelectSource,
}: SourceTreePanelProps) {
  /** 按来源类型分组构建树节点 */
  const buildTreeData = (): DataNode[] => {
    const grouped = new Map<RequirementSourceType, RequirementSourceDto[]>();
    for (const source of sources) {
      const list = grouped.get(source.type) ?? [];
      list.push(source);
      grouped.set(source.type, list);
    }

    const nodes: DataNode[] = [];
    for (const [type, list] of grouped.entries()) {
      const meta = SOURCE_TYPE_META[type] ?? SOURCE_TYPE_META.OTHER;
      const count = list.reduce((sum, s) => sum + s.requirementCount, 0);
      nodes.push({
        key: `type-${type}`,
        title: (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: meta.color,
              }}
            >
              {meta.icon}
              <Text strong style={{ fontSize: 13 }}>
                {meta.label}
              </Text>
            </span>
            <Tag
              color={meta.color}
              style={{
                fontSize: 11,
                margin: 0,
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {count}
            </Tag>
          </span>
        ),
        selectable: false,
        children: list.map((source) => ({
          key: `source-${source.id}`,
          title: (
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "4px 0",
              }}
            >
              <Text style={{ fontSize: 12, lineHeight: 1.3 }}>
                {source.title}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {source.requirementCount} requirements
                {source.externalRef ? ` · ${source.externalRef}` : ""}
              </Text>
            </span>
          ),
          isLeaf: true,
        })),
      });
    }
    return nodes;
  };

  return (
    <Card
      size="small"
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileTextOutlined />
          <Text strong style={{ fontSize: 13 }}>
            来源 / 需求树
          </Text>
        </span>
      }
      bodyStyle={{ padding: 8 }}
      style={{ height: "100%" }}
    >
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Spin />
        </div>
      ) : error && !isNotImplementedError(error) ? (
        <Alert
          type="error"
          message="来源加载失败"
          description={(error as Error)?.message ?? "请稍后重试"}
          showIcon
          style={{ margin: 8 }}
        />
      ) : sources.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ fontSize: 12 }}>
              {isNotImplementedError(error)
                ? "需求来源 API 待 V1 实现"
                : "暂无来源，请先导入来源文档"}
            </span>
          }
          style={{ padding: 24 }}
        />
      ) : (
        <Tree
          treeData={buildTreeData()}
          defaultExpandAll
          showLine
          onSelect={(keys) => {
            const key = keys[0] as string | undefined;
            if (key && key.startsWith("source-")) {
              onSelectSource(key.replace("source-", ""));
            }
          }}
          style={{ fontSize: 12 }}
        />
      )}
    </Card>
  );
}
