"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  Table,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Empty,
  Spin,
  Row,
  Col,
  Statistic,
  Progress,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  PlusOutlined,
  SearchOutlined,
  LayoutOutlined,
  TableOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import type {
  ProjectDto,
  ProjectStatus,
  BuildingType,
  StageCode,
} from "@design-platform/shared";
import { useProjects } from "@/hooks/use-projects";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

const STATUS_TAG_COLOR: Record<ProjectStatus, string> = {
  active: "green",
  on_hold: "orange",
  completed: "blue",
  cancelled: "red",
  archived: "default",
};

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: "Active", value: "active" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Archived", value: "archived" },
];

const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  office: "Office",
  residential: "Residential",
  commercial: "Commercial",
  mixed: "Mixed-use",
};

const STAGE_CODE_LABEL: Record<StageCode, string> = {
  "STG-P0": "前期策划",
  "STG-P1": "概念设计",
  "STG-P2": "方案设计",
  "STG-P3": "扩初设计",
  "STG-P4": "施工图设计",
  "STG-P5": "综合校审",
  "STG-P6": "发布交付",
  "STG-P7": "反馈变更",
  "STG-P8": "项目关闭",
};

function formatFloors(project: ProjectDto): string {
  if (project.floorsMin === project.floorsMax) {
    return String(project.floorsMin);
  }
  return `${project.floorsMin}-${project.floorsMax}`;
}

function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
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

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface ProjectCardProps {
  project: ProjectDto;
  currentStage: string;
  gateStatus: string;
  progress: number;
}

function ProjectCard({
  project,
  currentStage,
  gateStatus,
  progress,
}: ProjectCardProps) {
  const router = useRouter();
  const statusColor = STATUS_TAG_COLOR[project.status];

  return (
    <Card
      hoverable
      onClick={() => router.push(`/projects/${project.id}`)}
      style={{ cursor: "pointer" }}
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <Text code style={{ fontSize: 12 }}>
              {project.code}
            </Text>
            <Title level={4} style={{ margin: "4px 0 0" }}>
              {project.name}
            </Title>
          </div>
          <Tag color={statusColor}>
            {STATUS_OPTIONS.find((o) => o.value === project.status)?.label ??
              project.status}
          </Tag>
        </div>

        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <span>
              {BUILDING_TYPE_LABEL[project.buildingType]} ·{" "}
              {formatFloors(project)}F
            </span>
            <span>{formatDate(project.updatedAt)}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#64748b" }}>当前阶段</span>
            <Tag color="blue">{currentStage}</Tag>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#64748b" }}>门禁状态</span>
            <Tag
              color={
                gateStatus === "Pending"
                  ? "orange"
                  : gateStatus === "Approved"
                    ? "green"
                    : "default"
              }
            >
              {gateStatus}
            </Tag>
          </div>

          <Progress
            percent={progress}
            size="small"
            strokeColor="#2563eb"
            showInfo={false}
          />
        </Space>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/projects/${project.id}`);
            }}
          >
            查看详情
          </Button>
        </div>
      </Space>
    </Card>
  );
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [keywordInput, setKeywordInput] = useState(
    searchParams.get("keyword") ?? "",
  );
  const [keywordQuery, setKeywordQuery] = useState(keywordInput);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>(
    (searchParams.get("status") as ProjectStatus) ?? undefined,
  );
  const [stageFilter, setStageFilter] = useState<StageCode | undefined>(
    (searchParams.get("stage") as StageCode) ?? undefined,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeywordQuery(keywordInput);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (stageFilter) params.set("stage", stageFilter);
    if (keywordInput) params.set("keyword", keywordInput);
    router.push(`/projects?${params.toString()}`, { scroll: false });
  }, [statusFilter, stageFilter, keywordInput, router]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter,
      keyword: keywordQuery,
    }),
    [page, pageSize, statusFilter, keywordQuery],
  );

  const { data, isLoading, isError, error, isFetching } =
    useProjects(queryParams);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeywordQuery(keywordInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const columns: ColumnsType<ProjectDto> = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 160,
      ellipsis: true,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: ProjectStatus) => (
        <Tag color={STATUS_TAG_COLOR[status] ?? "default"}>
          {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
        </Tag>
      ),
    },
    {
      title: "Building Type",
      dataIndex: "buildingType",
      key: "buildingType",
      width: 140,
      render: (type: BuildingType) => BUILDING_TYPE_LABEL[type] ?? type,
    },
    {
      title: "Floors",
      key: "floors",
      width: 100,
      render: (_: unknown, record: ProjectDto) => formatFloors(record),
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (iso: string) => formatDateTime(iso),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_: unknown, record: ProjectDto) => (
        <Button
          type="link"
          size="small"
          onClick={() => router.push(`/projects/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    total: data?.total ?? 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 个项目`,
    onChange: (nextPage, nextSize) => {
      setPage(nextPage);
      if (nextSize !== pageSize) {
        setPageSize(nextSize);
        setPage(1);
      }
    },
  };

  const projects = data?.items ?? [];

  // 列表区域：加载/错误/数据三态
  // schema 校验失败或网络错误时用 DataErrorAlert 内联展示，替代 message.error() toast
  const tableRegion = (() => {
    if (isLoading) {
      return (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
        </div>
      );
    }
    if (isError) {
      return <DataErrorAlert error={error} context="项目列表" />;
    }
    return (
      <Table<ProjectDto>
        rowKey="id"
        columns={columns}
        dataSource={projects}
        loading={isFetching}
        pagination={pagination}
        scroll={{ x: 960 }}
        locale={{
          emptyText: <Empty description="暂无项目，可点击右上角新建" />,
        }}
      />
    );
  })();

  const STAGES = [
    "STG-P0",
    "STG-P1",
    "STG-P2",
    "STG-P3",
    "STG-P4",
    "STG-P5",
    "STG-P6",
    "STG-P7",
    "STG-P8",
  ] as StageCode[];

  const getMockStageInfo = (projectId: string) => {
    const hash = projectId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const stageIndex = Math.floor(hash % STAGES.length);
    const safeStageCode = STAGES[stageIndex] ?? "STG-P0";
    const progress = Math.round(((stageIndex + 1) / STAGES.length) * 100);
    const gateStatuses = ["Pending", "Approved", "Reviewing"] as const;
    const gateIndex = Math.floor(hash % gateStatuses.length);
    return {
      stageName: STAGE_CODE_LABEL[safeStageCode] ?? safeStageCode,
      progress,
      gateStatus: gateStatuses[gateIndex] ?? "Pending",
    };
  };

  const totalActive = projects.filter((p) => p.status === "active").length;
  const totalCompleted = projects.filter(
    (p) => p.status === "completed",
  ).length;
  const totalOnHold = projects.filter((p) => p.status === "on_hold").length;

  return (
    <>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            Projects
          </Title>
          <Space size="middle" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索项目编码或名称"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              style={{ width: 260 }}
              aria-label="项目搜索"
            />
            <Select<ProjectStatus | undefined>
              allowClear
              placeholder="状态筛选"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              style={{ width: 160 }}
              options={STATUS_OPTIONS}
              aria-label="状态筛选"
            />
            <Select<StageCode | undefined>
              allowClear
              placeholder="阶段筛选"
              value={stageFilter}
              onChange={(value) => {
                setStageFilter(value);
                setPage(1);
              }}
              style={{ width: 160 }}
              options={Object.entries(STAGE_CODE_LABEL).map(
                ([value, label]) => ({
                  label,
                  value: value as StageCode,
                }),
              )}
              aria-label="阶段筛选"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              新建项目
            </Button>
          </Space>
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Active Projects"
                value={totalActive}
                prefix={<Tag color="green" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Completed"
                value={totalCompleted}
                prefix={<Tag color="blue" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="On Hold"
                value={totalOnHold}
                prefix={<Tag color="orange" />}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#64748b" }}>{data?.total ?? 0} 个项目</Text>
            <Space>
              <Button
                type={viewMode === "card" ? "primary" : "default"}
                icon={<LayoutOutlined />}
                onClick={() => setViewMode("card")}
              >
                卡片视图
              </Button>
              <Button
                type={viewMode === "table" ? "primary" : "default"}
                icon={<TableOutlined />}
                onClick={() => setViewMode("table")}
              >
                列表视图
              </Button>
            </Space>
          </div>

          {viewMode === "card" ? (
            <Row gutter={[16, 16]}>
              {projects.length === 0 ? (
                <Col span={24}>
                  <Empty description="暂无项目，可点击右上角新建" />
                </Col>
              ) : (
                projects.map((project) => {
                  const info = getMockStageInfo(project.id);
                  return (
                    <Col xs={24} sm={12} lg={8} key={project.id}>
                      <ProjectCard
                        project={project}
                        currentStage={info.stageName}
                        gateStatus={info.gateStatus}
                        progress={info.progress}
                      />
                    </Col>
                  );
                })
              )}
            </Row>
          ) : (
            tableRegion
          )}

          {viewMode === "card" && projects.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <Button.Group>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </Button>
                <Button>{page}</Button>
                <Button
                  disabled={!data?.hasMore}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  下一页
                </Button>
              </Button.Group>
            </div>
          )}
        </Card>
      </Space>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
}
