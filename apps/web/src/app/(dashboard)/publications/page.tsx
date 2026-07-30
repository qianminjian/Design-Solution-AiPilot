"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  PUBLICATION_STATUS_COLOR,
  PUBLICATION_STATUS_LABEL,
  type PublicationDto,
  type PublicationStatus,
} from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { usePublications } from "@/hooks/use-publications";

const { Title, Text } = Typography;

/**
 * P11 发布中心 — 列表页（D37.15）
 *
 * 路由：/publications
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 Publication API 未实现，hook 返回 404/501 时显示空状态
 *  - 不伪造数据（对齐 D37 §空状态红线）
 *  - "新建发布"跳转 /publications/new
 *  - 点击行进入 /publications/{id} 查看发布详情
 *
 * 对齐 D37.15：
 *  - 显示发布编号、标题、Baseline、状态、收件人、Retention、签名状态
 *  - 空状态：引导用户从 Baseline 发起发布
 *
 * 安全红线（design-constraints.md）：
 *  - 所有发布必须由注册建筑师 / 工程师签章
 *  - 签名后对象锁定，不可篡改
 */

export default function PublicationsListPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    PublicationStatus | undefined
  >();

  const { data, isLoading, error, refetch, isFetching } = usePublications({
    keyword: keyword || undefined,
    status: statusFilter,
    page: 1,
    pageSize: 50,
  });

  const publications = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: ColumnsType<PublicationDto> = [
    {
      title: "编号",
      dataIndex: "code",
      key: "code",
      width: 110,
      fixed: "left",
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            发布人: {record.publisherName ?? record.publisherId}
          </Text>
        </Space>
      ),
    },
    {
      title: "Baseline",
      dataIndex: "baselineId",
      key: "baselineId",
      width: 160,
      render: (_, record) => (
        <Tooltip title={record.baselineHash}>
          <Space direction="vertical" size={0}>
            <Text code style={{ fontSize: 11 }}>
              {record.baselineId}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {record.baselineHash.length > 20
                ? `${record.baselineHash.slice(0, 20)}...`
                : record.baselineHash}
            </Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: PublicationStatus) => (
        <Tag color={PUBLICATION_STATUS_COLOR[status]}>
          {PUBLICATION_STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: "签名",
      key: "signatures",
      width: 110,
      align: "center",
      render: (_, record) => {
        const signed = record.signedCount ?? 0;
        const required = record.manifest?.requiredSignatures?.length ?? 0;
        const complete = required > 0 && signed >= required;
        return (
          <Tooltip
            title={
              complete
                ? "签名已完成"
                : required > 0
                  ? `还需 ${required - signed} 个签名`
                  : "未设置签名要求"
            }
          >
            <Tag color={complete ? "green" : "orange"}>
              {signed} / {required}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "收件人",
      dataIndex: "recipientsCount",
      key: "recipientsCount",
      width: 90,
      align: "center",
      render: (v?: number) => <Text>{v ?? 0}</Text>,
    },
    {
      title: "Retention",
      key: "retentionDays",
      width: 100,
      render: (_, record) => {
        const days = record.manifest?.retentionDays ?? 0;
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {days >= 365 ? `${(days / 365).toFixed(0)} 年` : `${days} 天`}
          </Text>
        );
      },
    },
    {
      title: "发布时间",
      dataIndex: "publishedAt",
      key: "publishedAt",
      width: 160,
      render: (val?: string | null) =>
        val ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(val).toLocaleString()}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 110,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/publications/${record.id}`);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

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
          onClick={() => router.push("/dashboard")}
          style={{ paddingLeft: 0 }}
        >
          返回首页
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/publications/new")}
        >
          新建发布
        </Button>
      </div>

      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <CloudUploadOutlined style={{ marginRight: 8 }} />
            发布中心
          </Title>
          <Text type="secondary">
            Publication Center（D37.15 P11）· V0 阶段：后端 API
            未实现时显示空状态
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="发布管理 API 待 V1 实现"
        description="后端 Publication / Submission / Signature / Recipient API 尚未实现，下方列表实时查询后端；返回 404/501 时显示空状态，不伪造数据。"
      />

      {/* 错误态 */}
      {error ? (
        <DataErrorAlert
          error={error}
          context="发布列表"
          variant="inline"
          onRetry={() => void refetch()}
          retryLabel="重试"
        />
      ) : null}

      {/* 过滤栏 */}
      <Card size="small">
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索编号 / 标题 / Baseline..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            aria-label="搜索发布"
          />
          <Select<PublicationStatus>
            allowClear
            placeholder="按状态筛选"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(PUBLICATION_STATUS_LABEL).map(
              ([value, label]) => ({
                value: value as PublicationStatus,
                label,
              }),
            )}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {total} 条发布
          </Text>
          <Tooltip title="刷新列表">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => void refetch()}
              loading={isFetching}
            >
              刷新
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* 列表 */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Spin spinning={isLoading}>
          {publications.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">暂无发布记录</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    后端未实现时显示空状态；点击右上角&quot;新建发布&quot;从
                    Baseline 发起发布
                  </Text>
                </Space>
              }
              style={{ padding: 48 }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => router.push("/publications/new")}
              >
                新建发布
              </Button>
            </Empty>
          ) : (
            <Table<PublicationDto>
              rowKey="id"
              columns={columns}
              dataSource={publications}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                total,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: 1200 }}
              size="small"
              onRow={(record) => ({
                onClick: () => router.push(`/publications/${record.id}`),
                style: { cursor: "pointer" },
              })}
            />
          )}
        </Spin>
      </Card>
    </Space>
  );
}
