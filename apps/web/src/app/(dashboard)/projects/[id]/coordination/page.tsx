"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
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
import {
  useBcfIssues,
  useUpdateBcfIssueStatus,
  useAssignBcfIssue,
  type BcfIssueStatus,
} from "@/hooks/use-review";
import { BcfIssueList } from "@/components/review/bcf-issue-list";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

/**
 * 多专业协调工作台
 * 参考 design-ui-system/pages/coordination.html (P07)
 *
 * 三大面板：
 * 1. 碰撞检测 — 多专业模型联邦冲突结果（后端待开发，暂用 Mock 占位）
 * 2. Issue 列表 — BCF (BIM Collaboration Format) 问题跟踪（已接入 useBcfIssues hook）
 * 3. 联邦状态 — 各专业模型上传与同步状态（后端待开发，暂用 Mock 占位）
 */

// ── Mock 数据类型（碰撞/联邦后端待开发，暂用前端占位）──

interface ClashResult {
  id: string;
  disciplineA: string;
  disciplineB: string;
  elementA: string;
  elementB: string;
  severity: "critical" | "major" | "minor";
  status: "open" | "resolved" | "ignored";
}

interface FederationStatus {
  discipline: string;
  modelFile: string;
  uploadedAt: string;
  status: "synced" | "stale" | "missing";
}

// ── Mock 数据（后续后端契约就绪后替换）──

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

// ── 列定义（碰撞/联邦） ──

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

  // BCF Issues 真实数据接入
  const bcfIssuesQuery = useBcfIssues(projectId);
  const updateStatusMutation = useUpdateBcfIssueStatus();
  const assignMutation = useAssignBcfIssue();

  const clashes = MOCK_CLASHES;
  const federation = MOCK_FEDERATION;
  const bcfIssues = bcfIssuesQuery.data ?? [];

  // 统计摘要
  const openClashes = clashes.filter((c) => c.status === "open").length;
  const criticalClashes = clashes.filter(
    (c) => c.severity === "critical" && c.status === "open",
  ).length;
  const openIssues = bcfIssues.filter((i) => i.status !== "closed").length;

  // BCF Issue 状态变更与指派回调
  const handleStatusChange = (issueId: string, status: BcfIssueStatus) => {
    void updateStatusMutation.mutateAsync({ issueId, status });
  };
  const handleAssign = (issueId: string, assignee: string) => {
    void assignMutation.mutateAsync({ issueId, assignee });
  };

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
              <>
                <Alert
                  type="info"
                  showIcon
                  message="碰撞检测功能待后端支持"
                  description="当前展示 Mock 占位数据，后端 coordination 端点开发完成后接入实际数据。"
                  style={{ marginBottom: 12 }}
                />
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
              </>
            ),
          },
          {
            key: "issues",
            label: `Issue 列表 (${openIssues} 待办)`,
            children: (
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                {bcfIssuesQuery.error && (
                  <DataErrorAlert
                    error={bcfIssuesQuery.error}
                    context="BCF 协调问题列表"
                    onRetry={() => void bcfIssuesQuery.refetch()}
                  />
                )}
                {updateStatusMutation.error && (
                  <DataErrorAlert
                    error={updateStatusMutation.error}
                    context="更新 BCF 问题状态"
                  />
                )}
                {assignMutation.error && (
                  <DataErrorAlert
                    error={assignMutation.error}
                    context="指派 BCF 问题"
                  />
                )}
                <BcfIssueList
                  data={bcfIssues}
                  loading={bcfIssuesQuery.isLoading}
                  onStatusChange={handleStatusChange}
                  onAssign={handleAssign}
                />
              </Space>
            ),
          },
          {
            key: "federation",
            label: "联邦模型状态",
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="联邦模型同步状态待后端支持"
                  description="当前展示 Mock 占位数据，后端 federation 端点开发完成后接入实际数据。"
                  style={{ marginBottom: 12 }}
                />
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
              </>
            ),
          },
        ]}
      />
    </Space>
  );
}
