"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Space,
  Spin,
  Card,
  Typography,
  Row,
  Col,
  Divider,
  Select,
  App,
} from "antd";
import {
  ArrowLeftOutlined,
  RestOutlined,
  FileSearchOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import {
  useComplianceCheck,
  useFindings,
  useGateSummary,
  useBcfIssues,
  useUpdateBcfIssueStatus,
  useAssignBcfIssue,
} from "@/hooks/use-review";
import type { BcfIssueStatus, BcfIssuePriority } from "@/hooks/use-review";
import { CheckResultList } from "@/components/review/check-result-list";
import { RagPanel } from "@/components/review/rag-panel";
import { FindingList } from "@/components/review/finding-list";
import { GateSummaryCard } from "@/components/review/gate-summary";
import { BcfIssueList } from "@/components/review/bcf-issue-list";
import { AiReviewPanel } from "@/components/review/ai-review-panel";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

/** BCF 问题状态筛选选项 */
const ISSUE_STATUS_OPTIONS: { label: string; value: BcfIssueStatus }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

/** BCF 问题优先级筛选选项 */
const ISSUE_PRIORITY_OPTIONS: { label: string; value: BcfIssuePriority }[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

/** 排序选项 */
const SORT_OPTIONS = [
  { label: "最新创建", value: "createdAt_desc" },
  { label: "最早创建", value: "createdAt_asc" },
  { label: "优先级（高→低）", value: "priority_desc" },
  { label: "优先级（低→高）", value: "priority_asc" },
] as const;

/** 优先级排序权重 */
const PRIORITY_WEIGHT: Record<BcfIssuePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export default function AiReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<BcfIssueStatus | undefined>(
    undefined,
  );
  const [priorityFilter, setPriorityFilter] = useState<
    BcfIssuePriority | undefined
  >(undefined);
  const [sortBy, setSortBy] = useState<string>("createdAt_desc");

  // 数据查询
  const {
    data: checkRun,
    isLoading: checkLoading,
    isError: checkError,
    refetch: refetchCheck,
  } = useComplianceCheck(projectId);

  const {
    data: findings,
    isLoading: findingsLoading,
    isError: findingsError,
  } = useFindings(projectId);

  const {
    data: gateSummary,
    isLoading: gateLoading,
    isError: gateError,
  } = useGateSummary(projectId);

  const {
    data: bcfIssues,
    isLoading: bcfLoading,
    isError: bcfError,
  } = useBcfIssues(projectId);

  const updateIssueStatus = useUpdateBcfIssueStatus();
  const assignIssue = useAssignBcfIssue();

  const anyLoading =
    checkLoading || findingsLoading || gateLoading || bcfLoading;

  const pendingCount =
    findings?.filter((f) => f.status === "pending").length ?? 0;
  const criticalCount =
    findings?.filter((f) => f.severity === "critical").length ?? 0;
  const approvedCount =
    findings?.filter((f) => f.status === "approved").length ?? 0;
  const rejectedCount =
    findings?.filter((f) => f.status === "rejected").length ?? 0;

  // BCF 问题筛选与排序
  const filteredIssues = useMemo(() => {
    if (!bcfIssues) return [];
    let result = [...bcfIssues];

    // 状态筛选
    if (statusFilter) {
      result = result.filter((issue) => issue.status === statusFilter);
    }
    // 优先级筛选
    if (priorityFilter) {
      result = result.filter((issue) => issue.priority === priorityFilter);
    }

    // 排序
    const [field, direction] = sortBy.split("_") as [string, "asc" | "desc"];
    const dir = direction === "asc" ? 1 : -1;
    result.sort((a, b) => {
      if (field === "createdAt") {
        return (
          dir *
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        );
      }
      if (field === "priority") {
        return (
          dir * (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
        );
      }
      return 0;
    });

    return result;
  }, [bcfIssues, statusFilter, priorityFilter, sortBy]);

  // BCF 问题统计
  const openIssueCount =
    bcfIssues?.filter((i) => i.status === "open").length ?? 0;
  const inProgressIssueCount =
    bcfIssues?.filter((i) => i.status === "in_progress").length ?? 0;

  // 处理状态变更
  const handleStatusChange = async (
    issueId: string,
    status: BcfIssueStatus,
  ) => {
    try {
      await updateIssueStatus.mutateAsync({ issueId, status });
      message.success("状态更新成功");
    } catch {
      message.error("状态更新失败");
    }
  };

  // 处理指派
  const handleAssign = async (issueId: string, assignee: string) => {
    try {
      await assignIssue.mutateAsync({ issueId, assignee });
      message.success("指派成功");
    } catch {
      message.error("指派失败");
    }
  };

  if (anyLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (checkError || findingsError || gateError || bcfError) {
    // 多数据源错误：优先展示第一个错误对象，由 DataErrorAlert 统一展示
    const firstError =
      checkError ?? findingsError ?? gateError ?? bcfError ?? null;
    return (
      <DataErrorAlert
        error={firstError}
        context="审签数据"
        variant="result"
        onRetry={() => router.push("/projects")}
        retryLabel="返回项目列表"
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
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
          返回项目详情
        </Button>
        <Button
          icon={<RestOutlined />}
          onClick={() => void refetchCheck()}
          loading={checkLoading}
        >
          重新检查
        </Button>
      </div>

      <div>
        <Title level={2} style={{ marginBottom: 4 }}>
          AI 审签中心
        </Title>
        <Text type="secondary">AI 辅助设计合规性与质量审查</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderLeft: "4px solid #faad14",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: "#fffbe6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RestOutlined style={{ color: "#faad14" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>待审查项</div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#faad14" }}
                >
                  {pendingCount}
                </div>
                {criticalCount > 0 && (
                  <div style={{ fontSize: 12, color: "#ff4d4f" }}>
                    {criticalCount} 项严重问题需关注
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderLeft: "4px solid #52c41a",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: "#f6ffed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileSearchOutlined style={{ color: "#52c41a" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>已批准</div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#52c41a" }}
                >
                  {approvedCount}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderLeft: "4px solid #ff4d4f",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: "#fff1f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileSearchOutlined style={{ color: "#ff4d4f" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>已拒绝</div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#ff4d4f" }}
                >
                  {rejectedCount}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderLeft: "4px solid #722ed1",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: "#f9f0ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RestOutlined style={{ color: "#722ed1" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>协调问题</div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#722ed1" }}
                >
                  {openIssueCount + inProgressIssueCount}
                </div>
                <div style={{ fontSize: 12, color: "#722ed1" }}>
                  {openIssueCount} Open / {inProgressIssueCount} In Progress
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <GateSummaryCard data={gateSummary ?? null} loading={gateLoading} />

      <Divider />

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileSearchOutlined />
                <Title level={4} style={{ margin: 0 }}>
                  规则检查结果
                </Title>
              </div>
            }
            size="small"
          >
            <CheckResultList
              data={checkRun?.results ?? []}
              loading={checkLoading}
            />
          </Card>
        </Col>
        <Col span={8}>
          <div style={{ height: "100%", minHeight: 500 }}>
            <RagPanel projectId={projectId} />
          </div>
        </Col>
      </Row>

      <Divider />

      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileSearchOutlined />
            <Title level={4} style={{ margin: 0 }}>
              合规发现分诊
            </Title>
          </div>
        }
        size="small"
      >
        <FindingList data={findings ?? []} loading={findingsLoading} />
      </Card>

      <Divider />

      {/* BCF 协调问题列表 */}
      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FilterOutlined />
            <Title level={4} style={{ margin: 0 }}>
              协调问题（BCF）
            </Title>
          </div>
        }
        size="small"
        extra={
          <Space size="middle" wrap>
            <Select<BcfIssueStatus | undefined>
              allowClear
              placeholder="状态筛选"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 140 }}
              options={ISSUE_STATUS_OPTIONS}
              aria-label="问题状态筛选"
            />
            <Select<BcfIssuePriority | undefined>
              allowClear
              placeholder="优先级筛选"
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value)}
              style={{ width: 140 }}
              options={ISSUE_PRIORITY_OPTIONS}
              aria-label="问题优先级筛选"
            />
            <Select
              placeholder="排序"
              value={sortBy}
              onChange={(value) => setSortBy(value)}
              style={{ width: 160 }}
              options={[...SORT_OPTIONS]}
              aria-label="排序方式"
            />
          </Space>
        }
      >
        <BcfIssueList
          data={filteredIssues}
          loading={bcfLoading}
          onStatusChange={handleStatusChange}
          onAssign={handleAssign}
        />
      </Card>

      <Divider />

      {/* AI 生成记录人工复核（AI 安全红线闭环，security.md §12） */}
      <AiReviewPanel projectId={projectId} />
    </Space>
  );
}
