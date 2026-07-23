"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Empty,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  WarningOutlined,
  IssuesCloseOutlined,
  ClusterOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;

/**
 * 多专业协调工作台
 * 参考 design-ui-system/pages/coordination.html (P07)
 *
 * 三大面板：
 * 1. 碰撞检测 — 多专业模型联邦冲突结果
 * 2. Issue 列表 — BCF (BIM Collaboration Format) 问题跟踪
 * 3. 联邦状态 — 各专业模型上传与同步状态
 *
 * 后端 coordination API 待开发，当前为前端框架占位
 */

// ── Mock 数据类型（后续替换为 shared 契约）──

interface ClashResult {
  id: string;
  disciplineA: string;
  disciplineB: string;
  elementA: string;
  elementB: string;
  severity: "critical" | "major" | "minor";
  status: "open" | "resolved" | "ignored";
}

interface BcfIssue {
  id: string;
  title: string;
  discipline: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "closed";
  assignee: string;
  createdAt: string;
}

interface FederationStatus {
  discipline: string;
  modelFile: string;
  uploadedAt: string;
  status: "synced" | "stale" | "missing";
}

// ── Mock 数据 ──

const MOCK_CLASHES: ClashResult[] = [
  {
    id: "C-001",
    disciplineA: "ARCH",
    disciplineB: "MEP",
    elementA: "Wall-123",
    elementB: "Pipe-456",
    severity: "critical",
    status: "open",
  },
  {
    id: "C-002",
    disciplineA: "STRUCT",
    disciplineB: "ARCH",
    elementA: "Beam-078",
    elementB: "Slab-012",
    severity: "major",
    status: "open",
  },
];

const MOCK_ISSUES: BcfIssue[] = [
  {
    id: "BCF-001",
    title: "管道穿越结构梁",
    discipline: "MEP",
    priority: "high",
    status: "open",
    assignee: "张工",
    createdAt: "2026-07-20T08:00:00Z",
  },
  {
    id: "BCF-002",
    title: "楼梯净高不足",
    discipline: "ARCH",
    priority: "medium",
    status: "in_progress",
    assignee: "李工",
    createdAt: "2026-07-21T10:30:00Z",
  },
];

const MOCK_FEDERATION: FederationStatus[] = [
  {
    discipline: "建筑",
    modelFile: "arch-model.rvt",
    uploadedAt: "2026-07-22T09:00:00Z",
    status: "synced",
  },
  {
    discipline: "结构",
    modelFile: "struct-model.rvt",
    uploadedAt: "2026-07-21T15:00:00Z",
    status: "stale",
  },
  { discipline: "给排水", modelFile: "—", uploadedAt: "—", status: "missing" },
  {
    discipline: "暖通",
    modelFile: "hvac-model.rvt",
    uploadedAt: "2026-07-22T11:00:00Z",
    status: "synced",
  },
  {
    discipline: "电气",
    modelFile: "elec-model.rvt",
    uploadedAt: "2026-07-20T14:00:00Z",
    status: "stale",
  },
];

// ── 列定义 ──

const clashColumns: ColumnsType<ClashResult> = [
  { title: "ID", dataIndex: "id", key: "id", width: 90 },
  { title: "专业 A", dataIndex: "disciplineA", key: "disciplineA", width: 80 },
  { title: "专业 B", dataIndex: "disciplineB", key: "disciplineB", width: 80 },
  { title: "构件 A", dataIndex: "elementA", key: "elementA" },
  { title: "构件 B", dataIndex: "elementB", key: "elementB" },
  {
    title: "严重性",
    dataIndex: "severity",
    key: "severity",
    width: 90,
    render: (s: ClashResult["severity"]) => {
      const color =
        s === "critical" ? "red" : s === "major" ? "orange" : "default";
      return <Tag color={color}>{s}</Tag>;
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 90,
    render: (s: ClashResult["status"]) => {
      const color =
        s === "open" ? "red" : s === "resolved" ? "green" : "default";
      return <Tag color={color}>{s}</Tag>;
    },
  },
];

const issueColumns: ColumnsType<BcfIssue> = [
  { title: "ID", dataIndex: "id", key: "id", width: 90 },
  { title: "标题", dataIndex: "title", key: "title" },
  { title: "专业", dataIndex: "discipline", key: "discipline", width: 80 },
  {
    title: "优先级",
    dataIndex: "priority",
    key: "priority",
    width: 80,
    render: (p: BcfIssue["priority"]) => {
      const color = p === "high" ? "red" : p === "medium" ? "orange" : "blue";
      return <Tag color={color}>{p}</Tag>;
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 100,
    render: (s: BcfIssue["status"]) => {
      const label =
        s === "open" ? "待处理" : s === "in_progress" ? "处理中" : "已关闭";
      const color =
        s === "open" ? "red" : s === "in_progress" ? "orange" : "green";
      return <Tag color={color}>{label}</Tag>;
    },
  },
  { title: "负责人", dataIndex: "assignee", key: "assignee", width: 80 },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 160,
    render: (t: string) => new Date(t).toLocaleString("zh-CN"),
  },
];

const federationColumns: ColumnsType<FederationStatus> = [
  { title: "专业", dataIndex: "discipline", key: "discipline", width: 100 },
  { title: "模型文件", dataIndex: "modelFile", key: "modelFile" },
  {
    title: "上传时间",
    dataIndex: "uploadedAt",
    key: "uploadedAt",
    width: 160,
    render: (t: string) =>
      t === "—" ? "—" : new Date(t).toLocaleString("zh-CN"),
  },
  {
    title: "同步状态",
    dataIndex: "status",
    key: "status",
    width: 100,
    render: (s: FederationStatus["status"]) => {
      const color = s === "synced" ? "green" : s === "stale" ? "orange" : "red";
      const label =
        s === "synced" ? "已同步" : s === "stale" ? "已过期" : "未上传";
      return <Tag color={color}>{label}</Tag>;
    },
  },
];

// ── 页面组件 ──

export default function CoordinationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("clashes");

  const clashes = MOCK_CLASHES;
  const issues = MOCK_ISSUES;
  const federation = MOCK_FEDERATION;

  // 统计摘要
  const openClashes = clashes.filter((c) => c.status === "open").length;
  const criticalClashes = clashes.filter(
    (c) => c.severity === "critical" && c.status === "open",
  ).length;
  const openIssues = issues.filter((i) => i.status !== "closed").length;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/projects/${projectId}`)}
          style={{ paddingLeft: 0 }}
        >
          返回项目
        </Button>
        <Space size="middle">
          <Tooltip title="严重碰撞数">
            <Tag color="red" icon={<WarningOutlined />}>
              严重碰撞 {criticalClashes}
            </Tag>
          </Tooltip>
          <Tooltip title="未关闭 Issue 数">
            <Tag color="orange" icon={<IssuesCloseOutlined />}>
              待办 Issue {openIssues}
            </Tag>
          </Tooltip>
          <Tooltip title="联邦模型同步数">
            <Tag color="blue" icon={<ClusterOutlined />}>
              已同步 {federation.filter((f) => f.status === "synced").length}/
              {federation.length}
            </Tag>
          </Tooltip>
        </Space>
      </div>

      {/* 标题 */}
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          多专业协调工作台
        </Title>
        <Text type="secondary">
          碰撞检测 · BCF Issue 追踪 · 联邦模型同步状态
        </Text>
      </div>

      {/* 三面板 Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "clashes",
            label: `碰撞检测 (${openClashes} 待处理)`,
            children: (
              <Table<ClashResult>
                columns={clashColumns}
                dataSource={clashes}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: false }}
                locale={{
                  emptyText: <Empty description="暂无碰撞记录" />,
                }}
              />
            ),
          },
          {
            key: "issues",
            label: `Issue 列表 (${openIssues} 待办)`,
            children: (
              <Table<BcfIssue>
                columns={issueColumns}
                dataSource={issues}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: false }}
                locale={{
                  emptyText: <Empty description="暂无 Issue" />,
                }}
              />
            ),
          },
          {
            key: "federation",
            label: "联邦模型状态",
            children: (
              <Table<FederationStatus>
                columns={federationColumns}
                dataSource={federation}
                rowKey="discipline"
                size="small"
                pagination={false}
                locale={{
                  emptyText: <Empty description="暂无联邦模型" />,
                }}
              />
            ),
          },
        ]}
      />
    </Space>
  );
}
