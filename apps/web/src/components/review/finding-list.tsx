"use client";

import { Table, Tag, Progress, Empty, Spin, Dropdown, MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { ComplianceFinding } from "@/hooks/use-review";

interface FindingListProps {
  data: ComplianceFinding[];
  loading?: boolean;
}

const severityConfig: Record<string, { color: string; label: string; icon: React.ElementType; bgColor: string }> = {
  critical: {
    color: "red",
    label: "严重",
    icon: WarningOutlined,
    bgColor: "#fff1f0",
  },
  high: {
    color: "orange",
    label: "高",
    icon: WarningOutlined,
    bgColor: "#fffbe6",
  },
  medium: {
    color: "gold",
    label: "中",
    icon: InfoCircleOutlined,
    bgColor: "#f6ffed",
  },
  low: {
    color: "blue",
    label: "低",
    icon: CheckCircleOutlined,
    bgColor: "#e6f7ff",
  },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "orange", label: "待处理" },
  approved: { color: "green", label: "已批准" },
  rejected: { color: "red", label: "已拒绝" },
  resolved: { color: "blue", label: "已解决" },
};

const columns: ColumnsType<ComplianceFinding> = [
  {
    title: "严重度",
    dataIndex: "severity",
    key: "severity",
    width: 80,
    align: "center",
    render: (severity) => {
      const config = severityConfig[severity] ?? { color: "default", label: "未知", icon: InfoCircleOutlined, bgColor: "#f5f5f5" };
      const Icon = config.icon;
      return (
        <Tag icon={<Icon />} color={config.color}>
          {config.label}
        </Tag>
      );
    },
  },
  {
    title: "规则",
    key: "rule",
    width: 180,
    render: (_, record) => (
      <div>
        <div style={{ fontWeight: 500 }}>{record.ruleName}</div>
        <Tag color="default" style={{ marginTop: 4 }}>
          {record.ruleCode}
        </Tag>
      </div>
    ),
  },
  {
    title: "适用对象",
    dataIndex: "objectName",
    key: "objectName",
    width: 150,
    ellipsis: true,
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
  },
  {
    title: "规范引用",
    dataIndex: "codeReference",
    key: "codeReference",
    width: 150,
    ellipsis: true,
    render: (ref) => <Tag color="blue">{ref}</Tag>,
  },
  {
    title: "置信度",
    dataIndex: "confidence",
    key: "confidence",
    width: 100,
    render: (confidence) => {
      const percent = Math.round(confidence * 100);
      return (
        <Progress
          percent={percent}
          size="small"
          strokeColor={
            percent >= 80 ? "#52c41a" : percent >= 50 ? "#faad14" : "#ff4d4f"
          }
        />
      );
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 80,
    render: (status) => {
      const config = statusConfig[status] ?? { color: "default", label: "未知" };
      return <Tag color={config.color}>{config.label}</Tag>;
    },
  },
  {
    title: "指派",
    dataIndex: "assignedTo",
    key: "assignedTo",
    width: 100,
    render: (assignedTo) => (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {assignedTo ? (
          <span>{assignedTo}</span>
        ) : (
          <span className="text-gray-400">未指派</span>
        )}
      </div>
    ),
  },
  {
    title: "操作",
    key: "action",
    width: 80,
    align: "center",
    render: () => {
      const items: MenuProps["items"] = [
        {
          key: "view",
          label: "查看详情",
        },
        {
          key: "approve",
          label: "批准发现",
        },
        {
          key: "reject",
          label: "拒绝发现",
        },
        {
          key: "assign",
          label: "指派处理人",
        },
      ];
      return (
        <Dropdown menu={{ items }}>
          <MoreOutlined style={{ cursor: "pointer" }} />
        </Dropdown>
      );
    },
  },
];

export function FindingList({ data, loading }: FindingListProps) {
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <Spin />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Empty description="暂无合规发现" />;
  }

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
      }}
      scroll={{ x: 1000 }}
    />
  );
}