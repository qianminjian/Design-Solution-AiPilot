"use client";

import { useEffect, useMemo, useState } from "react";
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
  App,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type {
  ProjectDto,
  ProjectStatus,
  BuildingType,
} from "@design-platform/shared";
import { useProjects } from "@/hooks/use-projects";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { ApiError } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 默认分页配置 */
const DEFAULT_PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

/** 状态 → Tag 颜色映射（D34 §项目状态） */
const STATUS_TAG_COLOR: Record<ProjectStatus, string> = {
  active: "green",
  on_hold: "orange",
  completed: "blue",
  cancelled: "red",
  archived: "default",
};

/** 状态选项 */
const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: "Active", value: "active" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Archived", value: "archived" },
];

/** 建筑类型 → 展示文本 */
const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  office: "Office",
  residential: "Residential",
  commercial: "Commercial",
  mixed: "Mixed-use",
};

/** 楼层数区间展示（如 5-15） */
function formatFloors(project: ProjectDto): string {
  if (project.floorsMin === project.floorsMax) {
    return String(project.floorsMin);
  }
  return `${project.floorsMin}-${project.floorsMax}`;
}

/** ISO 时间字符串 → 本地化展示 */
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

/**
 * 项目列表页
 * - Table 展示：Code / Name / Status / BuildingType / Floors / CreatedAt / 操作
 * - 顶部工具栏：搜索框（debounce 300ms）+ 状态筛选 + 新建项目按钮
 * - 分页控件（page + pageSize）
 * - TanStack Query 拉取数据，loading 用 Table.loading
 */
export default function ProjectsPage() {
  const { message } = App.useApp();

  // 输入态：用户输入的关键字
  const [keywordInput, setKeywordInput] = useState("");
  // 查询态：debounce 后的关键字，传给 useProjects
  const [keywordQuery, setKeywordQuery] = useState("");
  // 状态筛选
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>(
    undefined,
  );
  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // 新建项目弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // debounce 关键字：输入停止 DEBOUNCE_MS 后才触发查询
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeywordQuery(keywordInput);
      setPage(1); // 搜索条件变化时回到第一页
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

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

  // 查询失败时显示错误（仅当 error 变化时触发，避免重复弹窗）
  useEffect(() => {
    if (isError && error) {
      const tip =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "项目列表加载失败";
      message.error(tip);
    }
  }, [isError, error, message]);

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
      render: () => (
        <Button type="link" size="small" disabled>
          详情
        </Button>
      ),
    },
  ];

  // 服务端分页：total 由后端返回，current 跟随 page 状态
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
        setPage(1); // 切换 pageSize 时回到第一页
      }
    },
  };

  return (
    <>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                新建项目
              </Button>
            </Space>
          </div>

          <Table<ProjectDto>
            rowKey="id"
            columns={columns}
            dataSource={data?.items ?? []}
            loading={isLoading || isFetching}
            pagination={pagination}
            scroll={{ x: 960 }}
            locale={{
              emptyText: <Empty description="暂无项目，可点击右上角新建" />,
            }}
          />
        </Space>
      </Card>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
}
