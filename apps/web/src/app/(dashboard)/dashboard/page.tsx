"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  Empty,
  Input,
  List,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ProjectOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type {
  QuickActionType,
  WorkGroupKey,
  WorkItemDto,
  WorkItemRisk,
  WorkItemStatus,
  WorkItemType,
} from "@design-platform/shared";
import { useProjects } from "@/hooks/use-projects";
import { useQuickAction, useWorkItems } from "@/hooks/use-work-items";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;

/**
 * Dashboard 首页（V0 对齐 D37.5 P01 我的工作页）
 *
 * 三栏布局：
 *  - 左侧：Now/Overdue/Upcoming/Waiting/Completed 5 个时间分组（可点击切换筛选）
 *  - 中部：WorkItem DataGrid + SavedView 切换 + 关键字搜索 + 最近访问项目
 *  - 右侧：Quick Preview（选中工作项后显示详情、NextAction、快捷动作）
 *
 * V0 限制（对齐 D37.5 §空状态）：
 *  - 后端聚合查询 API（workflow.work.list）未就位
 *  - 区分"当前无任务 / 筛选无结果 / 数据同步中"3 种空状态
 *  - 不诱导创建无关任务，提供项目/最近访问作为兜底
 *  - 快捷动作（CLAIM/ACKNOWLEDGE/COMPLETE）禁用，待 V1 API 接入后启用
 */

// ── 工作项类型标签 ──
const WORK_TYPE_LABEL: Record<WorkItemType, string> = {
  TASK: "任务",
  ISSUE: "问题",
  REVIEW: "评审",
  APPROVAL: "审批",
  EXCEPTION: "异常",
  AI_REVIEW: "AI 复核",
};

const WORK_TYPE_COLOR: Record<WorkItemType, string> = {
  TASK: "blue",
  ISSUE: "orange",
  REVIEW: "purple",
  APPROVAL: "gold",
  EXCEPTION: "red",
  AI_REVIEW: "magenta",
};

// ── 风险等级标签 ──
const RISK_LABEL: Record<WorkItemRisk, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "严重",
};

const RISK_COLOR: Record<WorkItemRisk, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

// ── 状态标签 ──
const STATUS_LABEL: Record<WorkItemStatus, string> = {
  PENDING: "待处理",
  IN_PROGRESS: "进行中",
  WAITING: "等待他人",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  BLOCKED: "已阻塞",
};

const STATUS_COLOR: Record<WorkItemStatus, string> = {
  PENDING: "default",
  IN_PROGRESS: "processing",
  WAITING: "warning",
  COMPLETED: "success",
  CANCELLED: "default",
  BLOCKED: "error",
};

// ── 5 个时间分组（D37.5 左侧） ──
interface WorkGroupConfig {
  key: WorkGroupKey;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const WORK_GROUPS: WorkGroupConfig[] = [
  {
    key: "NOW",
    label: "Now",
    icon: <ClockCircleOutlined />,
    color: "#2563eb",
    description: "当前可执行",
  },
  {
    key: "OVERDUE",
    label: "Overdue",
    icon: <WarningOutlined />,
    color: "#dc2626",
    description: "已逾期",
  },
  {
    key: "UPCOMING",
    label: "Upcoming",
    icon: <CalendarOutlined />,
    color: "#d97706",
    description: "即将到期",
  },
  {
    key: "WAITING",
    label: "Waiting",
    icon: <PauseCircleOutlined />,
    color: "#64748b",
    description: "等待他人",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: <CheckCircleOutlined />,
    color: "#16a34a",
    description: "已完成",
  },
];

/** 内置 SavedView 列表（V0 后端未实现） */
const BUILTIN_SAVED_VIEWS = [
  { id: "all", name: "全部工作项", filters: {} },
  { id: "mine", name: "我的工作项", filters: { onlyMine: true } },
  {
    id: "high-risk",
    name: "高风险",
    filters: { risk: "HIGH" as WorkItemRisk },
  },
  {
    id: "critical",
    name: "严重风险",
    filters: { risk: "CRITICAL" as WorkItemRisk },
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { data, isLoading, isError, error } = useProjects({ pageSize: 5 });
  const recentProjects = useMemo(() => data?.items ?? [], [data]);

  // 工作项查询参数
  const [activeGroup, setActiveGroup] = useState<WorkGroupKey | null>(null);
  const [typeFilter, setTypeFilter] = useState<WorkItemType | undefined>();
  const [riskFilter, setRiskFilter] = useState<WorkItemRisk | undefined>();
  const [keyword, setKeyword] = useState("");
  const [savedViewId, setSavedViewId] = useState<string>("mine");
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItemDto | null>(
    null,
  );

  const queryParams = useMemo(() => {
    const view = BUILTIN_SAVED_VIEWS.find((v) => v.id === savedViewId);
    const viewFilters = view?.filters ?? {};
    return {
      group: activeGroup ?? undefined,
      type: typeFilter,
      risk: riskFilter,
      keyword: keyword.trim().length > 0 ? keyword.trim() : undefined,
      onlyMine: viewFilters.onlyMine ?? true,
      pageSize: 50,
    };
  }, [activeGroup, typeFilter, riskFilter, keyword, savedViewId]);

  const {
    data: workItemsData,
    isLoading: workItemsLoading,
    isError: workItemsError,
    error: workItemsErr,
    refetch,
  } = useWorkItems(queryParams);

  const workItems = workItemsData?.items ?? [];
  const quickActionMutation = useQuickAction();

  // 统计各分组数量（V0：基于当前已加载数据，仅作显示参考）
  const groupCounts = useMemo(() => {
    const counts = {
      NOW: 0,
      OVERDUE: 0,
      UPCOMING: 0,
      WAITING: 0,
      COMPLETED: 0,
    } as Record<WorkGroupKey, number>;
    for (const item of workItems) {
      if (item.status === "WAITING") counts.WAITING += 1;
      else if (item.status === "COMPLETED") counts.COMPLETED += 1;
      else if (item.slaDueAt) {
        const due = new Date(item.slaDueAt).getTime();
        const now = Date.now();
        const diffH = (due - now) / 3_600_000;
        if (diffH < 0) counts.OVERDUE += 1;
        else if (diffH <= 48) counts.UPCOMING += 1;
        else counts.NOW += 1;
      } else {
        counts.NOW += 1;
      }
    }
    return counts;
  }, [workItems]);

  // 空状态判定（对齐 D37.5 §空状态）
  const emptyState = useMemo(() => {
    if (workItemsLoading) return { kind: "loading" as const };
    if (workItemsError) return { kind: "error" as const };
    if (workItems.length === 0) {
      if (
        activeGroup ||
        typeFilter ||
        riskFilter ||
        keyword.trim().length > 0
      ) {
        return { kind: "filter-empty" as const };
      }
      return { kind: "no-tasks" as const };
    }
    return { kind: "has-data" as const };
  }, [
    workItemsLoading,
    workItemsError,
    workItems.length,
    activeGroup,
    typeFilter,
    riskFilter,
    keyword,
  ]);

  // 快捷动作处理
  const handleQuickAction = (item: WorkItemDto, action: QuickActionType) => {
    // D37.5 §主动作：高风险 COMPLETE 不允许在 P01 直接执行
    if (
      action === "COMPLETE" &&
      (item.risk === "HIGH" || item.risk === "CRITICAL")
    ) {
      modal.warning({
        title: "高风险完成需在详情页执行",
        icon: <ExclamationCircleOutlined />,
        content: (
          <Space direction="vertical" size={4}>
            <Text>
              工作项 {item.id} 风险等级为 {RISK_LABEL[item.risk]}，
            </Text>
            <Text>对齐 D37.5 §主动作：高风险动作需在工作项详情页执行。</Text>
            <Button
              type="link"
              size="small"
              onClick={() => router.push(`/projects/${item.projectId}`)}
            >
              前往详情页
            </Button>
          </Space>
        ),
      });
      return;
    }

    modal.confirm({
      title: `确认执行 ${action === "CLAIM" ? "认领" : action === "ACKNOWLEDGE" ? "确认" : "完成"} 操作？`,
      icon: <PlayCircleOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>
            工作项：<Text code>{item.id}</Text>
          </Text>
          <Text>标题：{item.title}</Text>
          <Text type="secondary">该操作将记录审计日志，且不可撤销。</Text>
        </Space>
      ),
      okText: "确认",
      cancelText: "取消",
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          quickActionMutation.mutate(
            {
              workItemId: item.id,
              actionType: action,
              reason: `Quick action ${action} from P01 dashboard`,
            },
            {
              onSuccess: () => {
                message.success(`操作成功：${item.id} 已 ${action}`);
                setSelectedWorkItem(null);
                resolve();
              },
              onError: (err) => {
                message.error(`操作失败：${err.message}`);
                reject(err);
              },
            },
          );
        });
      },
    });
  };

  // 表格列定义（对齐 D37.5 §核心组件）
  const columns: ColumnsType<WorkItemDto> = [
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      fixed: "left",
      render: (t: WorkItemType) => (
        <Tag color={WORK_TYPE_COLOR[t]} style={{ fontSize: 11 }}>
          {WORK_TYPE_LABEL[t]}
        </Tag>
      ),
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <Text strong>{title}</Text>
            {record.status === "BLOCKED" && (
              <Tooltip title={record.blockReason ?? "已阻塞"}>
                <Tag
                  color="error"
                  icon={<WarningOutlined />}
                  style={{ fontSize: 11 }}
                >
                  阻塞
                </Tag>
              </Tooltip>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.sourceLabel}
          </Text>
        </Space>
      ),
    },
    {
      title: "项目 / 阶段",
      key: "project",
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{record.projectName}</Text>
          <Space size={4}>
            {record.stageName && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.stageName}
              </Text>
            )}
            {record.discipline && (
              <Tag style={{ fontSize: 11 }}>{record.discipline}</Tag>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: "责任人",
      dataIndex: "assigneeName",
      key: "assignee",
      width: 120,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <UserOutlined />
            <Text style={{ fontSize: 12 }}>{name}</Text>
          </Space>
          {record.delegatedBy && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              代：{record.delegatedBy}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "SLA",
      dataIndex: "slaDueAt",
      key: "sla",
      width: 120,
      render: (ts: string | undefined, record) => {
        if (!ts) return <Text type="secondary">—</Text>;
        const due = new Date(ts);
        const now = new Date();
        const diffH = Math.floor((due.getTime() - now.getTime()) / 3_600_000);
        if (record.status === "COMPLETED") {
          return <Tag color="success">已完成</Tag>;
        }
        if (diffH < 0) {
          return (
            <Tag color="red" icon={<WarningOutlined />}>
              逾期 {-diffH}h
            </Tag>
          );
        }
        if (diffH <= 24) {
          return (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              {diffH}h
            </Tag>
          );
        }
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {due.toLocaleDateString("zh-CN")}
          </Text>
        );
      },
    },
    {
      title: "风险",
      dataIndex: "risk",
      key: "risk",
      width: 80,
      align: "center",
      render: (r: WorkItemRisk) => (
        <Tag color={RISK_COLOR[r]}>{RISK_LABEL[r]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: WorkItemStatus) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedWorkItem(record)}
        >
          预览
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 顶部欢迎区 */}
      <Card>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Space size="small">
            <Tag color="blue">V1 技术试点</Tag>
            <Tag>建筑专业纵向闭环</Tag>
          </Space>
          <Title level={3} style={{ margin: 0 }}>
            我的工作台
          </Title>
          <Text type="secondary">
            覆盖前期策划、概念设计、方案设计、扩初设计、施工图、多专业协同、审查、交付与变更
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="工作项聚合视图待 V1 接入"
        description="Task/Issue/Review/Approval/Exception/AIReview 聚合查询 API（workflow.work.list）尚未实现，下方分组显示空状态。可访问最近项目以继续工作。"
        action={
          <Button
            size="small"
            type="link"
            onClick={() => router.push("/projects")}
          >
            浏览全部项目
          </Button>
        }
      />

      {/* 三栏布局：左侧分组 + 中部工作项 + 右侧 Quick Preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 340px",
          gap: 16,
          minHeight: 600,
        }}
      >
        {/* 左侧：5 个时间分组（D37.5） */}
        <Card
          size="small"
          title={
            <>
              <UnorderedListOutlined /> 工作项分组
            </>
          }
        >
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            {WORK_GROUPS.map((group) => {
              const isActive = activeGroup === group.key;
              const count = groupCounts[group.key] ?? 0;
              return (
                <div
                  key={group.key}
                  onClick={() => setActiveGroup(isActive ? null : group.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${isActive ? group.color : "#e2e8f0"}`,
                    background: isActive ? `${group.color}08` : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 200ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = group.color;
                      e.currentTarget.style.background = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#f8fafc";
                    }
                  }}
                  aria-pressed={isActive}
                  role="button"
                  aria-label={`筛选 ${group.label} 分组`}
                >
                  <Space size="small">
                    <span style={{ color: group.color }}>{group.icon}</span>
                    <Space direction="vertical" size={0}>
                      <Text strong>{group.label}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {group.description}
                      </Text>
                    </Space>
                  </Space>
                  <Tag
                    color={count > 0 ? group.color : "default"}
                    style={{ minWidth: 28, textAlign: "center" }}
                  >
                    {count}
                  </Tag>
                </div>
              );
            })}

            <Divider style={{ margin: "8px 0" }} />

            <Button
              block
              size="small"
              type={activeGroup ? "default" : "primary"}
              onClick={() => setActiveGroup(null)}
            >
              全部工作项
            </Button>

            <Paragraph
              type="secondary"
              style={{ fontSize: 11, marginBottom: 0, marginTop: 8 }}
            >
              分组数量基于当前加载的数据，V1 接入聚合 API 后将提供全量统计。
            </Paragraph>
          </Space>
        </Card>

        {/* 中部：WorkItem DataGrid + SavedView + 关键字 + 最近项目 */}
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {/* 工具栏：SavedView + 关键字 + 类型 / 风险筛选 */}
          <Card size="small">
            <Space size="small" wrap style={{ width: "100%" }}>
              <Select
                value={savedViewId}
                onChange={setSavedViewId}
                style={{ minWidth: 180 }}
                options={BUILTIN_SAVED_VIEWS.map((v) => ({
                  value: v.id,
                  label: v.name,
                }))}
                suffixIcon={<SaveOutlined />}
              />
              <Input.Search
                placeholder="搜索标题 / 来源 / 项目"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={() => refetch()}
                allowClear
                style={{ width: 240 }}
              />
              <Segmented
                value={typeFilter ?? "all"}
                onChange={(v) =>
                  setTypeFilter(v === "all" ? undefined : (v as WorkItemType))
                }
                options={[
                  { label: "全部", value: "all" },
                  { label: "任务", value: "TASK" },
                  { label: "问题", value: "ISSUE" },
                  { label: "评审", value: "REVIEW" },
                  { label: "审批", value: "APPROVAL" },
                ]}
              />
              <Segmented
                value={riskFilter ?? "all"}
                onChange={(v) =>
                  setRiskFilter(v === "all" ? undefined : (v as WorkItemRisk))
                }
                options={[
                  { label: "全部风险", value: "all" },
                  { label: "低", value: "LOW" },
                  { label: "中", value: "MEDIUM" },
                  { label: "高", value: "HIGH" },
                  { label: "严重", value: "CRITICAL" },
                ]}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={workItemsLoading}
              >
                刷新
              </Button>
            </Space>
          </Card>

          {/* 工作项表格 */}
          <Card size="small" title="工作项列表">
            <Spin spinning={workItemsLoading}>
              {emptyState.kind === "error" ? (
                <DataErrorAlert error={workItemsErr} context="工作项聚合查询" />
              ) : emptyState.kind === "loading" ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="数据同步中..."
                />
              ) : emptyState.kind === "no-tasks" ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text>当前无任务</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        待 V1 接入工作项聚合查询 API
                      </Text>
                    </Space>
                  }
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<ProjectOutlined />}
                    onClick={() => router.push("/projects")}
                  >
                    浏览项目
                  </Button>
                </Empty>
              ) : emptyState.kind === "filter-empty" ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text>筛选无结果</Text>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => {
                          setActiveGroup(null);
                          setTypeFilter(undefined);
                          setRiskFilter(undefined);
                          setKeyword("");
                        }}
                      >
                        清除筛选
                      </Button>
                    </Space>
                  }
                />
              ) : (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={workItems}
                  pagination={{ pageSize: 20, size: "small" }}
                  scroll={{ x: 1200 }}
                  size="small"
                  locale={{
                    emptyText: "暂无工作项",
                  }}
                />
              )}
            </Spin>
          </Card>

          {/* 最近访问项目 */}
          <Card
            size="small"
            title="最近访问项目"
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => router.push("/projects")}
              >
                查看全部
              </Button>
            }
          >
            {isLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : isError ? (
              <DataErrorAlert error={error} context="最近项目" />
            ) : recentProjects.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无项目，请先创建"
              />
            ) : (
              <List
                size="small"
                dataSource={recentProjects.slice(0, 5)}
                renderItem={(project) => (
                  <List.Item
                    key={project.id}
                    actions={[
                      <Button
                        key="open"
                        size="small"
                        type="link"
                        icon={<ArrowRightOutlined />}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        aria-label={`打开项目 ${project.name}`}
                      >
                        打开
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size="small">
                          <Text strong>{project.name}</Text>
                          {project.code && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {project.code}
                            </Text>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {project.status ?? "—"}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Space>

        {/* 右侧：Quick Preview（D37.5 §快速预览 + §主动作） */}
        <Card size="small" title="快速预览">
          {selectedWorkItem ? (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Space size={4}>
                <Tag color={WORK_TYPE_COLOR[selectedWorkItem.type]}>
                  {WORK_TYPE_LABEL[selectedWorkItem.type]}
                </Tag>
                <Tag color={RISK_COLOR[selectedWorkItem.risk]}>
                  {RISK_LABEL[selectedWorkItem.risk]}
                </Tag>
                <Tag color={STATUS_COLOR[selectedWorkItem.status]}>
                  {STATUS_LABEL[selectedWorkItem.status]}
                </Tag>
              </Space>

              <Title level={5} style={{ margin: 0 }}>
                {selectedWorkItem.title}
              </Title>

              {selectedWorkItem.description && (
                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                  {selectedWorkItem.description}
                </Paragraph>
              )}

              <Divider style={{ margin: "8px 0" }} />

              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  项目
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {selectedWorkItem.projectName}
                </Text>
                {selectedWorkItem.stageName && (
                  <>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      阶段
                    </Text>
                    <Text style={{ fontSize: 12 }}>
                      {selectedWorkItem.stageName}
                    </Text>
                  </>
                )}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  来源
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {selectedWorkItem.sourceLabel}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  责任人
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {selectedWorkItem.assigneeName}
                  {selectedWorkItem.delegatedBy && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {" "}
                      （代：{selectedWorkItem.delegatedBy}）
                    </Text>
                  )}
                </Text>
                {selectedWorkItem.slaDueAt && (
                  <>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      SLA
                    </Text>
                    <Text style={{ fontSize: 12 }}>
                      {new Date(selectedWorkItem.slaDueAt).toLocaleString(
                        "zh-CN",
                      )}
                    </Text>
                  </>
                )}
                {selectedWorkItem.whyMe && (
                  <>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      WhyMe
                    </Text>
                    <Text style={{ fontSize: 12 }}>
                      {selectedWorkItem.whyMe}
                    </Text>
                  </>
                )}
              </Space>

              {selectedWorkItem.status === "BLOCKED" && (
                <Alert
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                  message="已阻塞"
                  description={selectedWorkItem.blockReason ?? "—"}
                  style={{ marginTop: 8 }}
                />
              )}

              {/* 下一动作（D37.5 §正常状态：一项仅一个明确 nextAction） */}
              {selectedWorkItem.nextAction && (
                <Card
                  size="small"
                  type="inner"
                  title="下一动作"
                  style={{ marginTop: 8 }}
                >
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    <Text strong>{selectedWorkItem.nextAction.label}</Text>
                    {selectedWorkItem.nextAction.actionType === "NAVIGATE" &&
                      selectedWorkItem.nextAction.targetUrl && (
                        <Button
                          type="link"
                          size="small"
                          icon={<ArrowRightOutlined />}
                          onClick={() => {
                            if (selectedWorkItem.nextAction?.targetUrl) {
                              router.push(
                                selectedWorkItem.nextAction.targetUrl,
                              );
                            }
                          }}
                        >
                          前往处理
                        </Button>
                      )}
                  </Space>
                </Card>
              )}

              <Divider style={{ margin: "8px 0" }} />

              {/* 快捷动作（D37.5 §主动作） */}
              <Tooltip title="快捷动作仅允许 Claim / Acknowledge / 低风险 Complete">
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  <Button
                    block
                    size="small"
                    icon={<UserOutlined />}
                    disabled={
                      quickActionMutation.isPending ||
                      selectedWorkItem.status === "COMPLETED"
                    }
                    onClick={() => handleQuickAction(selectedWorkItem, "CLAIM")}
                  >
                    Claim（认领）
                  </Button>
                  <Button
                    block
                    size="small"
                    icon={<CheckCircleOutlined />}
                    disabled={
                      quickActionMutation.isPending ||
                      selectedWorkItem.status === "COMPLETED"
                    }
                    onClick={() =>
                      handleQuickAction(selectedWorkItem, "ACKNOWLEDGE")
                    }
                  >
                    Acknowledge（确认）
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: "complete",
                          label: "Complete（完成）",
                          disabled:
                            selectedWorkItem.risk === "HIGH" ||
                            selectedWorkItem.risk === "CRITICAL",
                          onClick: () =>
                            handleQuickAction(selectedWorkItem, "COMPLETE"),
                        },
                      ],
                    }}
                  >
                    <Button
                      block
                      size="small"
                      icon={<DownOutlined />}
                      disabled={
                        quickActionMutation.isPending ||
                        selectedWorkItem.status === "COMPLETED"
                      }
                    >
                      Complete（低风险完成）
                    </Button>
                  </Dropdown>
                </Space>
              </Tooltip>

              {quickActionMutation.isPending && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  正在处理...
                </Text>
              )}

              <Paragraph
                type="secondary"
                style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}
              >
                快捷动作仅允许 Claim / Acknowledge / 低风险 Complete（对齐
                D37.5）。 高风险动作需在工作项详情页执行。
              </Paragraph>
            </Space>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="选中工作项后显示详情"
            >
              <Divider style={{ margin: "8px 0" }} />
              <Tooltip title="快捷动作仅在选中工作项后启用">
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  <Button block disabled size="small">
                    Claim（认领）
                  </Button>
                  <Button block disabled size="small">
                    Acknowledge（确认）
                  </Button>
                  <Button block disabled size="small">
                    Complete（低风险完成）
                  </Button>
                </Space>
              </Tooltip>
            </Empty>
          )}
        </Card>
      </div>

      {/* 底部状态栏 */}
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="工作项总数"
              value={workItems.length}
              prefix={<UnorderedListOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已逾期"
              value={groupCounts.OVERDUE}
              valueStyle={{ color: "#dc2626" }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="即将到期"
              value={groupCounts.UPCOMING}
              valueStyle={{ color: "#d97706" }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={groupCounts.COMPLETED}
              valueStyle={{ color: "#16a34a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V0 阶段工作项聚合查询 API 未就位，分组数量基于已加载数据；V1
        接入后将提供全量统计。 快捷动作（Claim/Acknowledge/Complete）按 D37.5
        §主动作约束，仅允许低风险操作； 高风险动作需在工作项详情页执行。
      </Text>
    </Space>
  );
}
