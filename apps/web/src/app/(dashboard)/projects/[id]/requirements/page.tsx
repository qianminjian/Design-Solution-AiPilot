"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Alert,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  SearchOutlined,
  PlusOutlined,
  ImportOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type {
  RequirementCategory,
  RequirementStatus,
  RequirementPriority,
} from "@design-platform/shared";
import { useProjectDetail } from "@/hooks/use-project-detail";
import {
  useRequirements,
  useRequirementSources,
} from "@/hooks/use-requirements";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { RequirementDetailRail } from "@/components/requirement/requirement-detail-rail";
import { SourceTreePanel } from "@/components/requirement/source-tree-panel";
import { CoverageSummaryBar } from "@/components/requirement/coverage-summary-bar";
import { ApiError } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 类别选项 */
const CATEGORY_OPTIONS: { label: string; value: RequirementCategory }[] = [
  { label: "Spatial", value: "SPATIAL" },
  { label: "Structural", value: "STRUCTURAL" },
  { label: "MEP", value: "MEP" },
  { label: "Fire Safety", value: "FIRE_SAFETY" },
  { label: "Accessibility", value: "ACCESSIBILITY" },
  { label: "Sustainability", value: "SUSTAINABILITY" },
  { label: "Other", value: "OTHER" },
];

/** 状态选项 */
const STATUS_OPTIONS: { label: string; value: RequirementStatus }[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Implemented", value: "IMPLEMENTED" },
  { label: "Superseded", value: "SUPERSEDED" },
  { label: "Rejected", value: "REJECTED" },
];

/** 类别标签颜色 */
const CATEGORY_COLOR: Record<RequirementCategory, string> = {
  SPATIAL: "blue",
  STRUCTURAL: "geekblue",
  MEP: "green",
  FIRE_SAFETY: "red",
  ACCESSIBILITY: "purple",
  SUSTAINABILITY: "cyan",
  OTHER: "default",
};

/** 优先级圆点 */
const PRIORITY_DOT_COLOR: Record<RequirementPriority, string> = {
  HIGH: "#dc2626",
  MEDIUM: "#d97706",
  LOW: "#64748b",
};

/** 状态徽标颜色 */
const STATUS_BADGE_COLOR: Record<RequirementStatus, string> = {
  DRAFT: "default",
  IN_REVIEW: "processing",
  APPROVED: "success",
  IMPLEMENTED: "blue",
  SUPERSEDED: "warning",
  REJECTED: "error",
};

/** 判断是否为后端未实现错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 501;
  }
  return false;
}

/**
 * P03 需求追踪矩阵页（D37.7）
 *
 * 路由：/projects/{projectId}/requirements
 *
 * 三栏布局（对齐 D37.7）：
 *  - 左侧 SourceTreePanel：来源/需求树
 *  - 中部 TraceGrid：需求列表 + Coverage Summary
 *  - 右侧 RequirementDetailRail：选中需求详情 / 变更历史 / Linked Elements
 *
 * 空状态（对齐 D37.7 §空状态红线）：
 *  - 无来源时显示"导入来源"引导，不伪造数据
 *  - 无 Trace 显示必需关系和建议，不自动创建虚假覆盖
 */
export default function RequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  // 项目详情（用于面包屑展示）
  const { data: projectDetail, isLoading: projectLoading } =
    useProjectDetail(projectId);

  // 过滤状态
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<RequirementCategory | undefined>();
  const [status, setStatus] = useState<RequirementStatus | undefined>();
  const [selectedRequirementId, setSelectedRequirementId] = useState<
    string | null
  >(null);

  // 查询需求列表
  const {
    data: requirementsData,
    isLoading: requirementsLoading,
    isError: requirementsError,
    error: requirementsErr,
  } = useRequirements(projectId, {
    keyword: keyword || undefined,
    category,
    status,
    pageSize: 50,
  });

  // 查询需求来源
  const {
    data: sources,
    isLoading: sourcesLoading,
    isError: sourcesError,
    error: sourcesErr,
  } = useRequirementSources(projectId);

  const requirements = useMemo(
    () => requirementsData?.items ?? [],
    [requirementsData],
  );

  const total = requirementsData?.total ?? 0;
  const notImplemented =
    isNotImplementedError(requirementsErr) || isNotImplementedError(sourcesErr);

  // 加载态
  if (projectLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // 项目不存在
  if (!projectDetail) {
    return (
      <DataErrorAlert
        error={null}
        context="项目"
        variant="result"
        onRetry={() => router.push("/projects")}
        retryLabel="返回项目列表"
      />
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部操作栏：返回 + 面包屑 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/projects/${projectId}`)}
            style={{ paddingLeft: 0 }}
          >
            返回项目
          </Button>
          <Text type="secondary">
            {projectDetail.project.name} / Requirements
          </Text>
        </Space>
        <Space>
          <Tooltip title="V0 阶段：导入来源功能待 V1 实现">
            <Button icon={<ImportOutlined />} disabled>
              导入来源
            </Button>
          </Tooltip>
          <Tooltip title="V0 阶段：新建需求功能待 V1 实现">
            <Button type="primary" icon={<PlusOutlined />} disabled>
              新建需求
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            需求与追踪矩阵
          </Title>
          <Text type="secondary">
            Requirements &amp; Traceability（D37.7 P03）
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 / 后端未实现提示 */}
      {notImplemented && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="需求域 API 待 V1 实现"
          description="后端 RequirementSource / Requirement / TraceLink / CoverageSummary API 尚未实现，下方页面以空状态展示骨架结构。待 V1 接入后即可直接对接。"
        />
      )}

      {/* Coverage Summary 汇总条 */}
      <CoverageSummaryBar projectId={projectId} />

      {/* 过滤栏 */}
      <Card size="small">
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索需求编号 / 标题 / 描述..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            aria-label="搜索需求"
          />
          <Select<RequirementCategory>
            allowClear
            placeholder="按类别筛选"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(val) => setCategory(val)}
            style={{ width: 160 }}
            aria-label="按类别筛选"
          />
          <Select<RequirementStatus>
            allowClear
            placeholder="按状态筛选"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(val) => setStatus(val)}
            style={{ width: 160 }}
            aria-label="按状态筛选"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {total} 条需求
          </Text>
        </Space>
      </Card>

      {/* 三栏布局：左侧来源树 / 中部需求列表 / 右侧详情 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 360px",
          gap: 16,
          minHeight: 480,
        }}
      >
        {/* 左侧：来源树 */}
        <SourceTreePanel
          sources={sources ?? []}
          loading={sourcesLoading}
          error={sourcesError ? sourcesErr : null}
          onSelectSource={() => {
            // V0：过滤逻辑由查询参数实现，简化为提示
            setSelectedRequirementId(null);
          }}
        />

        {/* 中部：需求列表 */}
        <Card
          size="small"
          title={
            <Space size="small">
              <Text strong>需求列表</Text>
              <Tag>{requirements.length}</Tag>
            </Space>
          }
          bodyStyle={{ padding: 0 }}
        >
          {requirementsLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 48,
              }}
            >
              <Spin />
            </div>
          ) : requirementsError && !notImplemented ? (
            <div style={{ padding: 16 }}>
              <DataErrorAlert
                error={requirementsErr}
                context="需求列表"
                variant="result"
              />
            </div>
          ) : requirements.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">
                    {notImplemented ? "需求域 API 待 V1 实现" : "暂无需求数据"}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    请先导入来源文档（业主任务书 / 规范 / 合同附件）
                  </Text>
                </Space>
              }
              style={{ padding: 48 }}
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "8px 12px", width: 96 }}>ID</th>
                    <th style={{ padding: "8px 12px", width: 100 }}>
                      Category
                    </th>
                    <th style={{ padding: "8px 12px" }}>Title</th>
                    <th style={{ padding: "8px 12px", width: 80 }}>Priority</th>
                    <th style={{ padding: "8px 12px", width: 110 }}>Status</th>
                    <th style={{ padding: "8px 12px", width: 100 }}>Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequirementId(req.id)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        background:
                          selectedRequirementId === req.id
                            ? "#eff6ff"
                            : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedRequirementId !== req.id) {
                          e.currentTarget.style.background = "#f8fafc";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedRequirementId !== req.id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <td style={{ padding: "8px 12px" }}>
                        <Text code style={{ fontSize: 12 }}>
                          {req.code}
                        </Text>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Tag color={CATEGORY_COLOR[req.category]}>
                          {req.subCategory ?? req.category}
                        </Tag>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Text strong style={{ fontSize: 13 }}>
                          {req.title}
                        </Text>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Space size={4}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: PRIORITY_DOT_COLOR[req.priority],
                              display: "inline-block",
                            }}
                          />
                          <Text style={{ fontSize: 12 }}>
                            {req.priority === "HIGH"
                              ? "High"
                              : req.priority === "MEDIUM"
                                ? "Med"
                                : "Low"}
                          </Text>
                        </Space>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Tag color={STATUS_BADGE_COLOR[req.status]}>
                          {req.status.replace("_", " ")}
                        </Tag>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <Text type="secondary">{req.linkedCount}</Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 右侧：需求详情 */}
        <RequirementDetailRail
          requirementId={selectedRequirementId}
          projectId={projectId}
        />
      </div>
    </Space>
  );
}
