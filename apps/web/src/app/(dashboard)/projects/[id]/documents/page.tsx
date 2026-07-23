"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Result,
  Typography,
  App,
} from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { DocumentStatus } from "@design-platform/shared";
import { useDocuments } from "@/hooks/use-documents";
import { DocumentList } from "@/components/cde/document-list";
import { ApiError } from "@/lib/api-client";

const { Title } = Typography;

/** 默认分页大小（与 projects 列表页一致） */
const DEFAULT_PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

/** 文档状态筛选选项 */
const STATUS_OPTIONS: { label: string; value: DocumentStatus }[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "Checked Out", value: "CHECKED_OUT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Superseded", value: "SUPERSEDED" },
  { label: "Archived", value: "ARCHIVED" },
];

/**
 * CDE 文档库页
 * - 文档列表表格（Name / Type / Status / Version / Size / Updated By / Updated At）
 * - 顶部工具栏：搜索框（debounce 300ms）+ 状态筛选 + 新建文档按钮（占位 onClick）
 * - 分页控件（page + pageSize）
 *
 * 参考 apps/web/src/app/(dashboard)/projects/page.tsx 的列表页模式
 */
export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  // 输入态：用户输入的关键字
  const [keywordInput, setKeywordInput] = useState("");
  // 查询态：debounce 后的关键字
  const [keywordQuery, setKeywordQuery] = useState("");
  // 状态筛选
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>(
    undefined,
  );
  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // debounce 关键字
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeywordQuery(keywordInput);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const { data, isLoading, isError, error, isFetching } = useDocuments(
    projectId,
    {
      page,
      pageSize,
      status: statusFilter,
      keyword: keywordQuery,
    },
  );

  // 错误提示
  useEffect(() => {
    if (isError && error) {
      const tip =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "文档列表加载失败";
      message.error(tip);
    }
  }, [isError, error, message]);

  // 错误态：404 显示专用 Result
  if (isError && !data) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <Result
        status={isNotFound ? "404" : "error"}
        title={isNotFound ? "项目不存在" : "加载失败"}
        subTitle={
          isNotFound
            ? "该项目可能已被删除或您无权访问"
            : error instanceof Error
              ? error.message
              : "请稍后重试"
        }
        extra={
          <Button type="primary" onClick={() => router.push("/projects")}>
            返回项目列表
          </Button>
        }
      />
    );
  }

  // 加载态（首次加载，无缓存数据）
  if (isLoading && !data) {
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

  // 分页配置：服务端分页，total 由后端返回
  const pagination: TablePaginationConfig = {
    current: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    total: data?.total ?? 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 个文档`,
    onChange: (nextPage, nextSize) => {
      setPage(nextPage);
      if (nextSize !== pageSize) {
        setPageSize(nextSize);
        setPage(1);
      }
    },
  };

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 顶部操作栏 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Space size="middle">
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push(`/projects/${projectId}`)}
              style={{ paddingLeft: 0 }}
            >
              返回项目详情
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              Documents
            </Title>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => message.info("新建文档功能建设中")}
          >
            新建文档
          </Button>
        </div>

        {/* 工具栏：搜索 + 状态筛选 */}
        <Space size="middle" wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索文档名称"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            style={{ width: 260 }}
            aria-label="文档搜索"
          />
          <Select<DocumentStatus | undefined>
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
        </Space>

        {/* 文档表格 */}
        <DocumentList
          documents={data?.items ?? []}
          loading={isLoading || isFetching}
          pagination={pagination}
        />
      </Space>
    </Card>
  );
}
