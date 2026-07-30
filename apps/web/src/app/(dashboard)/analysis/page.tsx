"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Progress,
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
  PlusOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  AnalysisProblemDto,
  AnalysisProblemType,
  ProblemStatus,
  RunStatus,
} from "@design-platform/shared";
import {
  useAnalysisProblems,
  useProblemStatusSummary,
} from "@/hooks/use-analysis";

const { Title, Text } = Typography;

/** 问题类型标签 */
const TYPE_LABEL: Record<AnalysisProblemType, string> = {
  STRUCTURAL: "结构",
  WIND: "风工程",
  THERMAL: "热工",
  ENERGY: "能耗",
  LIGHTING: "光环境",
  ACOUSTIC: "声环境",
  DAYLIGHT: "日照",
  FIRE: "消防",
  GEOTECHNICAL: "岩土",
  OTHER: "其他",
};

const TYPE_COLOR: Record<AnalysisProblemType, string> = {
  STRUCTURAL: "magenta",
  WIND: "cyan",
  THERMAL: "orange",
  ENERGY: "green",
  LIGHTING: "gold",
  ACOUSTIC: "purple",
  DAYLIGHT: "blue",
  FIRE: "red",
  GEOTECHNICAL: "volcano",
  OTHER: "default",
};

/** 问题状态标签 */
const STATUS_LABEL: Record<ProblemStatus, string> = {
  DRAFT: "草稿",
  READY: "就绪",
  RUNNING: "运行中",
  COMPLETED: "已完成",
  REVIEWED: "已审查",
  INVALID: "已失效",
};

const STATUS_COLOR: Record<ProblemStatus, string> = {
  DRAFT: "default",
  READY: "blue",
  RUNNING: "processing",
  COMPLETED: "gold",
  REVIEWED: "success",
  INVALID: "error",
};

/** 运行状态标签 */
const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  QUEUED: "排队中",
  LICENSING: "等待许可证",
  PREPARING: "准备中",
  RUNNING: "运行中",
  POST_PROCESSING: "后处理",
  CONVERGED: "已收敛",
  DIVERGED: "已发散",
  CANCELLED: "已取消",
  FAILED: "失败",
  UNKNOWN: "未知",
};

const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  QUEUED: "default",
  LICENSING: "default",
  PREPARING: "blue",
  RUNNING: "processing",
  POST_PROCESSING: "blue",
  CONVERGED: "success",
  DIVERGED: "warning",
  CANCELLED: "default",
  FAILED: "error",
  UNKNOWN: "warning",
};

export default function AnalysisListPage() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    AnalysisProblemType | undefined
  >();
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | undefined>();

  const filter = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      type: typeFilter,
      status: statusFilter,
    }),
    [keyword, typeFilter, statusFilter],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAnalysisProblems(filter);

  // data 为 OffsetPageResponse<AnalysisProblemDto>，取 items 为列表
  const problems = data?.items ?? [];
  const summary = useProblemStatusSummary(problems);

  const columns: ColumnsType<AnalysisProblemDto> = [
    {
      title: "编号",
      dataIndex: "code",
      key: "code",
      width: 120,
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
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            {record.projectName} · {record.owner} ({record.ownerRole})
          </Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: AnalysisProblemType) => (
        <Tag color={TYPE_COLOR[type]}>{TYPE_LABEL[type]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: ProblemStatus) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "输入完整度",
      dataIndex: "inputCompleteness",
      key: "inputCompleteness",
      width: 140,
      render: (value: number, record) => {
        const status =
          value >= 100 ? "success" : value >= 80 ? "active" : "exception";
        const tag = record.requiresHumanReview ? (
          <Tooltip title="需要人工复核">
            <WarningOutlined style={{ color: "#faad14", marginLeft: 4 }} />
          </Tooltip>
        ) : null;
        return (
          <Space size={4}>
            <Progress percent={value} size="small" status={status} />
            {tag}
          </Space>
        );
      },
    },
    {
      title: "最近运行",
      dataIndex: "latestRunStatus",
      key: "latestRunStatus",
      width: 120,
      render: (status: RunStatus | undefined, record) => {
        if (!status) return <Text type="secondary">—</Text>;
        const tag = (
          <Tag color={RUN_STATUS_COLOR[status]}>{RUN_STATUS_LABEL[status]}</Tag>
        );
        if (record.latestResultQuality === "QUESTIONABLE") {
          return (
            <Space size={4}>
              {tag}
              <Tooltip title="结果可疑，需复核">
                <ExclamationCircleOutlined style={{ color: "#faad14" }} />
              </Tooltip>
            </Space>
          );
        }
        if (record.latestResultQuality === "INVALID") {
          return (
            <Space size={4}>
              {tag}
              <Tooltip title="结果无效">
                <WarningOutlined style={{ color: "#ff4d4f" }} />
              </Tooltip>
            </Space>
          );
        }
        return tag;
      },
    },
    {
      title: "运行次数",
      dataIndex: "runCount",
      key: "runCount",
      width: 90,
      align: "center",
      render: (n: number) => <Tag color={n > 0 ? "blue" : "default"}>{n}</Tag>,
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 140,
      render: (t: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(t).toLocaleString("zh-CN")}
        </Text>
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
        <Space>
          <Tooltip title="V0 阶段：新建工程分析问题待 V1 实现">
            <Button type="primary" icon={<PlusOutlined />} disabled>
              新建工程分析
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <ExperimentOutlined style={{ marginRight: 8 }} />
            工程分析运行与结果质量
          </Title>
          <Text type="secondary">
            Engineering Analysis（D37.14 P10）· 对接后端真实 API
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="工程分析域已对接后端 API"
        description="AnalysisProblem / Scenario / Run / Result / SolverProfile API 已由 Core Service 提供，前端通过 BFF 代理透传访问。若后端服务未启动或返回 404/501，列表将显示空状态。"
      />

      {/* 状态汇总卡 */}
      <Col span={24}>
        <Space size="middle" wrap>
          <Card size="small" style={{ minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ExperimentOutlined style={{ color: "#722ed1" }} />
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>总问题数</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {summary.total}
                </div>
              </div>
            </div>
          </Card>
          <Card size="small" style={{ minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ThunderboltOutlined style={{ color: "#1890ff" }} />
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>运行中</div>
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: "#1890ff" }}
                >
                  {summary.running}
                </div>
              </div>
            </div>
          </Card>
          <Card size="small" style={{ minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>已完成</div>
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: "#52c41a" }}
                >
                  {summary.completed}
                </div>
              </div>
            </div>
          </Card>
          <Card size="small" style={{ minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WarningOutlined style={{ color: "#faad14" }} />
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>结果可疑</div>
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: "#faad14" }}
                >
                  {summary.questionable}
                </div>
              </div>
            </div>
          </Card>
          <Card size="small" style={{ minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>已失效</div>
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: "#ff4d4f" }}
                >
                  {summary.invalid}
                </div>
              </div>
            </div>
          </Card>
        </Space>
      </Col>

      {/* 过滤栏 */}
      <Card size="small">
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Input
            allowClear
            prefix={<ExperimentOutlined />}
            placeholder="搜索编号 / 标题 / 负责人..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            aria-label="搜索工程分析"
          />
          <Select<AnalysisProblemType>
            allowClear
            placeholder="按类型筛选"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
              value: value as AnalysisProblemType,
              label,
            }))}
          />
          <Select<ProblemStatus>
            allowClear
            placeholder="按状态筛选"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value: value as ProblemStatus,
              label,
            }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {problems.length} 条
          </Text>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={isFetching}
            onClick={() => void refetch()}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 错误提示 */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={
            error instanceof Error ? error.message : "请稍后重试或检查网络"
          }
          action={
            <Button size="small" onClick={() => void refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* 列表 */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Spin spinning={isLoading}>
          {problems.length === 0 && !isLoading ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">暂无工程分析问题</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    可切换筛选条件或检查后端服务状态
                  </Text>
                </Space>
              }
              style={{ padding: 48 }}
            />
          ) : (
            <Table<AnalysisProblemDto>
              rowKey="id"
              columns={columns}
              dataSource={problems}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1200 }}
              size="small"
              onRow={(record) => ({
                onClick: () => router.push(`/analysis/problems/${record.id}`),
                style: { cursor: "pointer" },
              })}
            />
          )}
        </Spin>
      </Card>
    </Space>
  );
}
