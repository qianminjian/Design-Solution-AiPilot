"use client";

import { Table, Tag, Progress, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ComplianceCheckResult } from "@/hooks/use-review";
import type { CheckResultStatus } from "./review-config";
import { CheckResultStatusBadge } from "./review-badge";

interface CheckResultListProps {
  data: ComplianceCheckResult[];
  loading?: boolean;
}

const columns: ColumnsType<ComplianceCheckResult> = [
  {
    title: "规则名称",
    dataIndex: "ruleName",
    key: "ruleName",
    ellipsis: true,
    width: 200,
  },
  {
    title: "规则编码",
    dataIndex: "ruleCode",
    key: "ruleCode",
    width: 120,
    render: (code) => <Tag color="default">{code}</Tag>,
  },
  {
    title: "适用对象数",
    dataIndex: "applicableObjects",
    key: "applicableObjects",
    width: 100,
    align: "center",
  },
  {
    title: "通过",
    dataIndex: "passCount",
    key: "passCount",
    width: 80,
    align: "center",
    render: (count) => (
      <span className="text-green-600 font-medium">{count}</span>
    ),
  },
  {
    title: "失败",
    dataIndex: "failCount",
    key: "failCount",
    width: 80,
    align: "center",
    render: (count) => (
      <span className="text-red-600 font-medium">{count}</span>
    ),
  },
  {
    title: "不适用",
    dataIndex: "naCount",
    key: "naCount",
    width: 80,
    align: "center",
    render: (count) => <span className="text-gray-500">{count}</span>,
  },
  {
    title: "不确定",
    dataIndex: "uncertainCount",
    key: "uncertainCount",
    width: 80,
    align: "center",
    render: (count) => <span className="text-yellow-600">{count}</span>,
  },
  {
    title: "通过率",
    key: "passRate",
    width: 120,
    render: (_, record) => {
      const total = record.applicableObjects - record.naCount;
      if (total === 0) return "-";
      const rate = Math.round((record.passCount / total) * 100);
      return (
        <Progress
          percent={rate}
          size="small"
          strokeColor={
            rate >= 80 ? "#52c41a" : rate >= 50 ? "#faad14" : "#ff4d4f"
          }
        />
      );
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (status: CheckResultStatus | string | undefined | null) => (
      <CheckResultStatusBadge value={status} />
    ),
  },
];

export function CheckResultList({ data, loading }: CheckResultListProps) {
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
    return <Empty description="暂无检查结果" />;
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
      scroll={{ x: 800 }}
    />
  );
}
