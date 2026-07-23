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
  Drawer,
  Badge,
  Collapse,
} from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SearchOutlined,
  HistoryOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { DocumentDto, DocumentStatus } from "@design-platform/shared";
import { useDocuments, useDocumentVersions } from "@/hooks/use-documents";
import { DocumentList } from "@/components/cde/document-list";
import { DocumentUpload } from "@/components/cde/document-upload";
import { DocumentVersionHistory } from "@/components/cde/document-version-history";
import { ApiError } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

/** 文档状态筛选选项（含 Badge 颜色） */
const STATUS_OPTIONS: { label: string; value: DocumentStatus }[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "Checked Out", value: "CHECKED_OUT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Superseded", value: "SUPERSEDED" },
  { label: "Archived", value: "ARCHIVED" },
];

/** 文档状态 Badge 状态映射 */
const STATUS_BADGE_STATUS: Record<DocumentStatus, "default" | "processing" | "success" | "warning" | "error"> = {
  DRAFT: "default",
  CHECKED_OUT: "processing",
  PUBLISHED: "success",
  SUPERSEDED: "warning",
  ARCHIVED: "error",
};

/**
 * CDE 文档库页
 * - 文档列表表格
 * - 拖拽上传区域（Collapse 折叠）
 * - 文档版本历史抽屉
 * - 状态筛选（带 Badge 标识）
 */
export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  // 输入态
  const [keywordInput, setKeywordInput] = useState("");
  // 查询态：debounce 后
  const [keywordQuery, setKeywordQuery] = useState("");
  // 状态筛选
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>(undefined);
  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // 版本历史抽屉
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDto | null>(null);

  // debounce 关键字
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeywordQuery(keywordInput);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const { data, isLoading, isError, error, isFetching, refetch } = useDocuments(
    projectId,
    {
      page,
      pageSize,
      status: statusFilter,
      keyword: keywordQuery,
    },
  );

  // 版本历史查询
  const {
    data: versions,
    isLoading: versionsLoading,
  } = useDocumentVersions(selectedDocument?.id ?? null);

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

  // 打开版本历史抽屉
  const handleOpenVersions = (doc: DocumentDto) => {
    setSelectedDocument(doc);
    setVersionDrawerOpen(true);
  };

  // 错误态
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

  // 加载态
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

  // 分页配置
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

  // 各状态文档数量
  const statusCounts: Partial<Record<DocumentStatus, number>> = {};
  for (const item of data?.items ?? []) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  }

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
          <Space>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                if (selectedDocument) {
                  setVersionDrawerOpen(true);
                } else {
                  message.info("请先选择文档查看版本历史");
                }
              }}
            >
              版本历史
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => message.info("新建文档功能建设中")}
            >
              新建文档
            </Button>
          </Space>
        </div>

        {/* 文档状态概览条 */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((opt) => {
            const count = statusCounts[opt.value] ?? 0;
            return (
              <Badge
                key={opt.value}
                status={STATUS_BADGE_STATUS[opt.value]}
                text={`${opt.label}: ${count}`}
                style={{ fontSize: 13 }}
              />
            );
          })}
        </div>

        {/* 拖拽上传区域（折叠） */}
        <Collapse
          ghost
          items={[
            {
              key: "upload",
              label: (
                <Space>
                  <UploadOutlined />
                  <Text>上传文档</Text>
                </Space>
              ),
              children: (
                <DocumentUpload
                  projectId={projectId}
                  onUploadComplete={() => void refetch()}
                />
              ),
            },
          ]}
        />

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
          onRowClick={handleOpenVersions}
        />
      </Space>

      {/* 版本历史抽屉 */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            <span>版本历史</span>
            {selectedDocument && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {selectedDocument.name}
              </Text>
            )}
          </Space>
        }
        placement="right"
        width={480}
        open={versionDrawerOpen}
        onClose={() => {
          setVersionDrawerOpen(false);
          setSelectedDocument(null);
        }}
      >
        <DocumentVersionHistory
          versions={versions ?? []}
          loading={versionsLoading}
        />
      </Drawer>
    </Card>
  );
}
