"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  ClusterOutlined,
  CommentOutlined,
  FilterOutlined,
  IssuesCloseOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  BcfIssue,
  ClashRunDto,
  ClusterDto,
  CoordinationFindingSeverity,
  CoordinationFindingStatus,
  FindingDto,
} from "@design-platform/shared";
import { useBcfIssues } from "@/hooks/use-review";
import {
  useClusters,
  useCreateIssueFromFinding,
  useFindings,
} from "@/hooks/use-coordination";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { IssueContextRail } from "./_components/issue-context-rail";
import { RuleMatrix } from "./_components/rule-matrix";
import { RunSelector } from "./_components/run-selector";
import {
  WaiverCreateModal,
  WaiverReviewModal,
} from "./_components/waiver-panel";

const { Title, Text } = Typography;

/**
 * P07 协调、碰撞与 Issue 工作台
 * 对齐 @design/D37-关键界面-交互状态.md §D37.11
 *
 * 三栏布局：
 *   ┌────────────────────┬──────────────────────────┬──────────────────┐
 *   │ Run/规则选择       │ Finding/Cluster/Issue     │ Issue Context    │
 *   │  - RunSelector     │  - Segmented 切换         │  - Viewpoint     │
 *   │  - RuleMatrix      │  - DataGrid               │  - Comment       │
 *   │                    │  - 批量动作               │  - Waiver        │
 *   └────────────────────┴──────────────────────────┴──────────────────┘
 *
 * 主动作：验证候选并创建/关联 Issue（D37.11 §主动作）
 *  - Run 结果不能直接成为已确认 Issue，必须人工确认
 *  - 关闭 Issue 需验证新模型版本和证据
 *
 * V0：后端 Coordination API（D11）尚未实现，前端通过 hook 空状态展示
 */

// ── 枚举映射 ──

const FINDING_SEVERITY_COLOR: Record<CoordinationFindingSeverity, string> = {
  CRITICAL: "red",
  HIGH: "orange",
  MEDIUM: "gold",
  LOW: "default",
};

const FINDING_SEVERITY_LABEL: Record<CoordinationFindingSeverity, string> = {
  CRITICAL: "严重",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

const FINDING_STATUS_COLOR: Record<CoordinationFindingStatus, string> = {
  OPEN: "red",
  CLUSTERED: "blue",
  LINKED: "purple",
  RESOLVED: "green",
  IGNORED: "default",
  WAIVED: "warning",
};

const FINDING_STATUS_LABEL: Record<CoordinationFindingStatus, string> = {
  OPEN: "待处理",
  CLUSTERED: "已聚类",
  LINKED: "已关联",
  RESOLVED: "已解决",
  IGNORED: "已忽略",
  WAIVED: "已豁免",
};

const BCF_STATUS_LABEL: Record<BcfIssue["status"], string> = {
  open: "待处理",
  in_progress: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

const BCF_STATUS_COLOR: Record<BcfIssue["status"], string> = {
  open: "red",
  in_progress: "processing",
  resolved: "green",
  closed: "default",
};

const BCF_PRIORITY_LABEL: Record<BcfIssue["priority"], string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

// ── 页面组件 ──

export default function CoordinationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  // 选中状态
  const [selectedRun, setSelectedRun] = useState<ClashRunDto | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null,
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<
    "findings" | "clusters" | "issues"
  >("findings");
  const [findingKeyword, setFindingKeyword] = useState("");

  // 创建/审核 Waiver 模态框状态
  const [waiverCreateOpen, setWaiverCreateOpen] = useState(false);
  const [waiverReviewOpen, setWaiverReviewOpen] = useState(false);

  // ── 数据 hooks ──

  // BCF Issues（来自 review 域）
  const bcfIssuesQuery = useBcfIssues(projectId);

  // Findings & Clusters（依赖 selectedRun）
  const findingsQuery = useFindings({
    runId: selectedRun?.id ?? "",
    keyword: findingKeyword,
    pageSize: 100,
  });

  const clustersQuery = useClusters({
    runId: selectedRun?.id ?? "",
    pageSize: 100,
  });

  const createIssueFromFindingMutation = useCreateIssueFromFinding();

  // ── 派生数据 ──

  const findings = useMemo(
    () => findingsQuery.data?.items ?? [],
    [findingsQuery.data],
  );
  const clusters = useMemo(
    () => clustersQuery.data?.items ?? [],
    [clustersQuery.data],
  );
  const bcfIssues = useMemo(
    () => bcfIssuesQuery.data ?? [],
    [bcfIssuesQuery.data],
  );

  const selectedFinding = useMemo(
    () => findings.find((f) => f.id === selectedFindingId) ?? null,
    [findings, selectedFindingId],
  );

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );

  // 顶部摘要统计
  const summary = useMemo(() => {
    const openFindings = findings.filter((f) => f.status === "OPEN").length;
    const criticalFindings = findings.filter(
      (f) => f.severity === "CRITICAL" && f.status === "OPEN",
    ).length;
    const pendingClusters = clusters.filter(
      (c) => c.status === "PROPOSED",
    ).length;
    const openIssues = bcfIssues.filter((i) => i.status !== "closed").length;
    return { openFindings, criticalFindings, pendingClusters, openIssues };
  }, [findings, clusters, bcfIssues]);

  // ── 回调 ──

  const handleRunChange = (run: ClashRunDto) => {
    setSelectedRun(run);
    setSelectedFindingId(null);
    setSelectedClusterId(null);
  };

  const handleFindingSelect = (finding: FindingDto) => {
    setSelectedFindingId(finding.id);
    if (finding.issueId) {
      setSelectedIssueId(finding.issueId);
    }
  };

  const handleClusterSelect = (cluster: ClusterDto) => {
    setSelectedClusterId(cluster.id);
    if (cluster.issueId) {
      setSelectedIssueId(cluster.issueId);
    }
  };

  const handleIssueSelect = (issue: BcfIssue) => {
    setSelectedIssueId(issue.id);
  };

  const handleCreateIssueFromFinding = async () => {
    if (!selectedFinding && !selectedCluster) {
      return;
    }
    const severity: CoordinationFindingSeverity | undefined =
      selectedFinding?.severity ?? selectedCluster?.primarySeverity;
    const priority: "critical" | "high" | "medium" | "low" = severity
      ? (severity.toLowerCase() as "critical" | "high" | "medium" | "low")
      : "medium";
    try {
      const result = await createIssueFromFindingMutation.mutateAsync({
        projectId,
        findingId: selectedFinding?.id,
        clusterId: selectedCluster?.id,
        title: selectedFinding
          ? `${selectedFinding.ruleCode}: ${selectedFinding.sourceElementName} ↔ ${selectedFinding.targetElementName}`
          : `${selectedCluster?.primaryRuleCode}: ${selectedCluster?.title}`,
        description:
          selectedFinding?.description ?? selectedCluster?.title ?? "",
        priority,
      });
      if (result.issueId) {
        setSelectedIssueId(result.issueId);
      }
    } catch {
      // 错误由 mutation 错误状态展示
    }
  };

  // ── 列定义 ──

  const findingColumns: ColumnsType<FindingDto> = [
    {
      title: "#",
      dataIndex: "findingIndex",
      key: "findingIndex",
      width: 50,
    },
    {
      title: "严重性",
      dataIndex: "severity",
      key: "severity",
      width: 80,
      render: (s: CoordinationFindingSeverity) => (
        <Tag color={FINDING_SEVERITY_COLOR[s]}>{FINDING_SEVERITY_LABEL[s]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (s: CoordinationFindingStatus) => (
        <Tag color={FINDING_STATUS_COLOR[s]}>{FINDING_STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "规则",
      dataIndex: "ruleCode",
      key: "ruleCode",
      width: 100,
      render: (code: string) => (
        <Text style={{ fontFamily: "monospace", fontSize: 11 }}>{code}</Text>
      ),
    },
    {
      title: "源构件",
      key: "source",
      render: (_, record) => (
        <Tooltip
          title={`${record.sourceDiscipline} · ${record.sourceModelVersion}`}
        >
          <Text style={{ fontSize: 12 }}>{record.sourceElementName}</Text>
        </Tooltip>
      ),
    },
    {
      title: "目标构件",
      key: "target",
      render: (_, record) => (
        <Tooltip
          title={`${record.targetDiscipline} · ${record.targetModelVersion}`}
        >
          <Text style={{ fontSize: 12 }}>{record.targetElementName}</Text>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record) =>
        record.status === "OPEN" ? (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedFindingId(record.id);
              void handleCreateIssueFromFinding();
            }}
            loading={createIssueFromFindingMutation.isPending}
          >
            创建 Issue
          </Button>
        ) : record.issueId ? (
          <Button
            type="link"
            size="small"
            onClick={() => setSelectedIssueId(record.issueId!)}
          >
            查看 Issue
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            —
          </Text>
        ),
    },
  ];

  const clusterColumns: ColumnsType<ClusterDto> = [
    {
      title: "#",
      dataIndex: "clusterIndex",
      key: "clusterIndex",
      width: 50,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "主规则",
      dataIndex: "primaryRuleCode",
      key: "primaryRuleCode",
      width: 100,
      render: (code: string) => (
        <Text style={{ fontFamily: "monospace", fontSize: 11 }}>{code}</Text>
      ),
    },
    {
      title: "主严重性",
      dataIndex: "primarySeverity",
      key: "primarySeverity",
      width: 90,
      render: (s: CoordinationFindingSeverity) => (
        <Tag color={FINDING_SEVERITY_COLOR[s]}>{FINDING_SEVERITY_LABEL[s]}</Tag>
      ),
    },
    {
      title: "Finding 数",
      dataIndex: "findingCount",
      key: "findingCount",
      width: 90,
      align: "center" as const,
      render: (n: number) => (
        <Badge
          count={n}
          style={{ backgroundColor: "#1677ff" }}
          overflowCount={999}
        />
      ),
    },
    {
      title: "AI 置信度",
      dataIndex: "aiConfidence",
      key: "aiConfidence",
      width: 100,
      render: (c?: number | null) =>
        c === null || c === undefined ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            —
          </Text>
        ) : (
          <Text style={{ fontSize: 11 }}>{(c * 100).toFixed(0)}%</Text>
        ),
    },
    {
      title: "状态",
      key: "status",
      width: 110,
      render: (_, record) => {
        if (record.humanReviewed) {
          return (
            <Tag color="green">
              <SafetyCertificateOutlined /> 已审核
            </Tag>
          );
        }
        return (
          <Tag color="processing">
            <ThunderboltOutlined /> 待审核
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record) =>
        record.status === "PROPOSED" ? (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedClusterId(record.id);
              void handleCreateIssueFromFinding();
            }}
            loading={createIssueFromFindingMutation.isPending}
          >
            创建 Issue
          </Button>
        ) : record.issueId ? (
          <Button
            type="link"
            size="small"
            onClick={() => setSelectedIssueId(record.issueId!)}
          >
            查看 Issue
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            —
          </Text>
        ),
    },
  ];

  const bcfIssueColumns: ColumnsType<BcfIssue> = [
    {
      title: "#",
      dataIndex: "issueIndex",
      key: "issueIndex",
      width: 50,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 80,
      render: (p: BcfIssue["priority"]) => (
        <Tag
          color={
            p === "critical"
              ? "red"
              : p === "high"
                ? "orange"
                : p === "medium"
                  ? "gold"
                  : "default"
          }
        >
          {BCF_PRIORITY_LABEL[p]}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: BcfIssue["status"]) => (
        <Tag color={BCF_STATUS_COLOR[s]}>{BCF_STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "类型",
      dataIndex: "issueType",
      key: "issueType",
      width: 120,
      render: (t: string) => <Tag style={{ fontSize: 11 }}>{t}</Tag>,
    },
    {
      title: "指派",
      dataIndex: "assignedTo",
      key: "assignedTo",
      width: 100,
      render: (a?: string | null) =>
        a ? (
          <Text style={{ fontSize: 11 }}>{a}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            未指派
          </Text>
        ),
    },
  ];

  // ── 渲染 ──

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space size="middle" align="center">
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/projects/${projectId}`)}
            style={{ paddingLeft: 0 }}
          >
            返回项目
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            协调、碰撞与 Issue 工作台
          </Title>
        </Space>
        <Space size="middle">
          <Tooltip title="严重 Finding 数">
            <Tag color="red" icon={<WarningOutlined />}>
              严重 {summary.criticalFindings}
            </Tag>
          </Tooltip>
          <Tooltip title="待处理 Finding 数">
            <Tag color="orange" icon={<IssuesCloseOutlined />}>
              待处理 {summary.openFindings}
            </Tag>
          </Tooltip>
          <Tooltip title="待审核 Cluster 数">
            <Tag color="blue" icon={<ClusterOutlined />}>
              待审核 {summary.pendingClusters}
            </Tag>
          </Tooltip>
          <Tooltip title="未关闭 Issue 数">
            <Tag color="purple" icon={<CommentOutlined />}>
              待办 Issue {summary.openIssues}
            </Tag>
          </Tooltip>
        </Space>
      </div>

      {/* AI 安全红线提示 */}
      <Alert
        type="info"
        showIcon
        message="Run 结果不能直接成为已确认 Issue，须人工确认"
        description="D37.11 §主动作约束：验证候选并创建/关联 Issue；关闭 Issue 需验证新模型版本和证据。所有 Waiver 操作进入审计日志。"
        style={{ margin: "8px 16px 0" }}
      />

      {/* 三栏布局 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 320px",
          gap: 1,
          background: "#f0f0f0",
          flex: 1,
          minHeight: 0,
          margin: "8px 0 0",
        }}
      >
        {/* 左栏：Run + 规则 */}
        <div
          style={{
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <RunSelector
              projectId={projectId}
              selectedRunId={selectedRun?.id ?? null}
              onRunChange={handleRunChange}
              onCreateRun={() => {
                // V0 阶段：Run 创建流程待后端实现后接入
              }}
            />
          </div>
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              height: "40%",
              minHeight: 200,
              overflow: "hidden",
            }}
          >
            <RuleMatrix
              projectId={projectId}
              appliedRuleIds={selectedRun?.ruleIds}
              onRuleSelect={() => {
                // V0 阶段：仅展示
              }}
            />
          </div>
        </div>

        {/* 中栏：DataGrid */}
        <div
          style={{
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Segmented
              value={activeDataTab}
              onChange={(v) => setActiveDataTab(v as typeof activeDataTab)}
              options={[
                {
                  label: `Finding (${findings.length})`,
                  value: "findings",
                },
                {
                  label: `Cluster (${clusters.length})`,
                  value: "clusters",
                },
                {
                  label: `Issue (${bcfIssues.length})`,
                  value: "issues",
                },
              ]}
            />
            <Space size="small">
              {activeDataTab === "findings" && (
                <Input
                  size="small"
                  placeholder="搜索构件/规则"
                  prefix={<SearchOutlined />}
                  value={findingKeyword}
                  onChange={(e) => setFindingKeyword(e.target.value)}
                  style={{ width: 180 }}
                  allowClear
                />
              )}
              <Tooltip title="刷新">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    if (activeDataTab === "findings") {
                      void findingsQuery.refetch();
                    } else if (activeDataTab === "clusters") {
                      void clustersQuery.refetch();
                    } else {
                      void bcfIssuesQuery.refetch();
                    }
                  }}
                />
              </Tooltip>
              <Tooltip title="筛选">
                <Button size="small" icon={<FilterOutlined />} />
              </Tooltip>
            </Space>
          </div>

          {/* Run 选择提示 */}
          {activeDataTab !== "issues" && !selectedRun && (
            <Alert
              type="info"
              showIcon
              message="请先选择协调运行"
              description="在左侧选择 ClashRun 后查看 Finding / Cluster 数据"
              style={{ margin: 12 }}
            />
          )}

          {/* 错误状态 */}
          {activeDataTab === "findings" && findingsQuery.error && (
            <DataErrorAlert
              error={findingsQuery.error}
              context="Finding 列表"
              onRetry={() => void findingsQuery.refetch()}
            />
          )}
          {activeDataTab === "clusters" && clustersQuery.error && (
            <DataErrorAlert
              error={clustersQuery.error}
              context="Cluster 列表"
              onRetry={() => void clustersQuery.refetch()}
            />
          )}
          {activeDataTab === "issues" && bcfIssuesQuery.error && (
            <DataErrorAlert
              error={bcfIssuesQuery.error}
              context="BCF Issue 列表"
              onRetry={() => void bcfIssuesQuery.refetch()}
            />
          )}

          {/* 表格内容 */}
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {activeDataTab === "findings" && (
              <Table<FindingDto>
                columns={findingColumns}
                dataSource={findings}
                rowKey="id"
                size="small"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                }}
                loading={findingsQuery.isLoading}
                locale={{
                  emptyText: selectedRun ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="该 Run 无 Finding"
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="选择 Run 后展示 Finding"
                    />
                  ),
                }}
                rowSelection={{
                  type: "checkbox",
                  onChange: (keys) => {
                    if (keys.length > 0) {
                      const id = keys[keys.length - 1] as string;
                      const finding = findings.find((f) => f.id === id);
                      if (finding) handleFindingSelect(finding);
                    }
                  },
                  selectedRowKeys: selectedFindingId ? [selectedFindingId] : [],
                }}
                onRow={(record) => ({
                  onClick: () => handleFindingSelect(record),
                  style: { cursor: "pointer" },
                })}
              />
            )}

            {activeDataTab === "clusters" && (
              <Table<ClusterDto>
                columns={clusterColumns}
                dataSource={clusters}
                rowKey="id"
                size="small"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                }}
                loading={clustersQuery.isLoading}
                locale={{
                  emptyText: selectedRun ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="该 Run 无 Cluster"
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="选择 Run 后展示 Cluster"
                    />
                  ),
                }}
                rowSelection={{
                  type: "radio",
                  onChange: (keys) => {
                    const id = keys[0] as string;
                    const cluster = clusters.find((c) => c.id === id);
                    if (cluster) handleClusterSelect(cluster);
                  },
                  selectedRowKeys: selectedClusterId ? [selectedClusterId] : [],
                }}
                onRow={(record) => ({
                  onClick: () => handleClusterSelect(record),
                  style: { cursor: "pointer" },
                })}
              />
            )}

            {activeDataTab === "issues" && (
              <Table<BcfIssue>
                columns={bcfIssueColumns}
                dataSource={bcfIssues}
                rowKey="id"
                size="small"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                }}
                loading={bcfIssuesQuery.isLoading}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无 Issue"
                    />
                  ),
                }}
                rowSelection={{
                  type: "radio",
                  onChange: (keys) => {
                    const id = keys[0] as string;
                    const issue = bcfIssues.find((i) => i.id === id);
                    if (issue) handleIssueSelect(issue);
                  },
                  selectedRowKeys: selectedIssueId ? [selectedIssueId] : [],
                }}
                onRow={(record) => ({
                  onClick: () => handleIssueSelect(record),
                  style: { cursor: "pointer" },
                })}
              />
            )}
          </div>

          {/* 底部操作栏 */}
          {(selectedFinding || selectedCluster) && (
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #f0f0f0",
                background: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选：{selectedFinding?.ruleCode ?? selectedCluster?.title}
              </Text>
              <Space size="small">
                <Button
                  type="primary"
                  icon={<IssuesCloseOutlined />}
                  loading={createIssueFromFindingMutation.isPending}
                  onClick={() => void handleCreateIssueFromFinding()}
                >
                  创建 Issue
                </Button>
              </Space>
            </div>
          )}
        </div>

        {/* 右栏：Issue Context */}
        <div
          style={{
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <IssueContextRail
            issueId={selectedIssueId}
            onCreateComment={() => {
              // V0 占位：评论创建流程待接入
            }}
            onCreateWaiver={() => setWaiverCreateOpen(true)}
            onCreateViewpoint={() => {
              // V0 占位：视点创建依赖 Viewer 集成
            }}
            onViewpointSelect={() => {
              // V0 占位：定位 Viewer
            }}
          />
        </div>
      </div>

      {/* Waiver 创建/审核模态框 */}
      <WaiverCreateModal
        open={waiverCreateOpen}
        issueId={selectedIssueId}
        onClose={() => setWaiverCreateOpen(false)}
      />
      <WaiverReviewModal
        open={waiverReviewOpen}
        waiver={null}
        onClose={() => setWaiverReviewOpen(false)}
      />
    </div>
  );
}
