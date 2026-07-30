"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tabs,
  Timeline,
  Typography,
} from "antd";
import {
  AuditOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  ExportOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  GovernanceAuditLog,
  GovernanceEvidencePackage,
} from "@design-platform/shared";
import {
  useAuditLogs,
  useEvidencePackages,
  useEvidencePackageAction,
} from "@/hooks/use-governance";

const { Title, Text, Paragraph } = Typography;

/** 日期范围类型（使用原生 Date 替代 dayjs，避免引入新依赖） */
type DateRange = [Date, Date] | null;

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 预设时间范围 */
const TIME_PRESETS: Array<{
  label: string;
  value: string;
  range: () => DateRange;
}> = [
  { label: "全部", value: "all", range: () => null },
  {
    label: "今天",
    value: "today",
    range: () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return [start, new Date()];
    },
  },
  {
    label: "近 7 天",
    value: "7d",
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return [start, new Date()];
    },
  },
  {
    label: "近 30 天",
    value: "30d",
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return [start, new Date()];
    },
  },
  {
    label: "近 90 天",
    value: "90d",
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return [start, new Date()];
    },
  },
];

const CATEGORY_LABEL: Record<GovernanceAuditLog["category"], string> = {
  auth: "认证",
  data: "数据",
  governance: "治理",
  ai: "AI",
  publication: "发布",
  admin: "系统",
};

const CATEGORY_COLOR: Record<GovernanceAuditLog["category"], string> = {
  auth: "blue",
  data: "geekblue",
  governance: "purple",
  ai: "magenta",
  publication: "gold",
  admin: "default",
};

const RESULT_LABEL: Record<GovernanceAuditLog["result"], string> = {
  success: "成功",
  failure: "失败",
  denied: "拒绝",
  error: "错误",
};

const RESULT_COLOR: Record<GovernanceAuditLog["result"], string> = {
  success: "success",
  failure: "error",
  denied: "warning",
  error: "error",
};

const RISK_COLOR: Record<GovernanceAuditLog["riskLevel"], string> = {
  low: "default",
  medium: "blue",
  high: "orange",
  critical: "red",
};

const ACTOR_TYPE_LABEL: Record<GovernanceAuditLog["actor"]["type"], string> = {
  user: "用户",
  service: "服务",
  ai: "AI",
  system: "系统",
};

const EVIDENCE_STATUS_LABEL: Record<
  GovernanceEvidencePackage["status"],
  string
> = {
  draft: "开放",
  sealed: "已封存",
  verified: "已验证",
  challenged: "已质疑",
};

const EVIDENCE_STATUS_COLOR: Record<
  GovernanceEvidencePackage["status"],
  string
> = {
  draft: "default",
  sealed: "blue",
  verified: "success",
  challenged: "warning",
};

/**
 * Audit/Evidence 页面（D37.17 治理中心）
 *
 * 首屏组成：时间 / Actor / Object / Action / Trace 查询、证据包验证
 * 主要动作：export / seal / verify
 * 特殊状态：脱敏视图、WORM、查询过大长任务
 *
 * 数据来源：BFF GovernanceProxyController → Core Service AuditLog/EvidencePackage Controller
 */
export default function AuditPage() {
  const { message, modal } = App.useApp();
  const [activeTab, setActiveTab] = useState("entries");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [timePreset, setTimePreset] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<GovernanceAuditLog | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // 根据 preset 计算当前时间范围
  const timeRange: DateRange = useMemo(() => {
    const preset = TIME_PRESETS.find((p) => p.value === timePreset);
    return preset?.range() ?? null;
  }, [timePreset]);

  // 服务端查询参数（关键字搜索仍走客户端，服务端不支持模糊匹配）
  const auditQueryParams = useMemo(() => {
    const params: Parameters<typeof useAuditLogs>[0] = {
      page: 1,
      pageSize: 100,
      category:
        categoryFilter === "all"
          ? undefined
          : (categoryFilter as GovernanceAuditLog["category"]),
      result:
        resultFilter === "all"
          ? undefined
          : (resultFilter as GovernanceAuditLog["result"]),
      riskLevel:
        riskFilter === "all"
          ? undefined
          : (riskFilter as GovernanceAuditLog["riskLevel"]),
    };
    if (timeRange && timeRange[0] && timeRange[1]) {
      params.from = timeRange[0].toISOString();
      params.to = timeRange[1].toISOString();
    }
    return params;
  }, [categoryFilter, resultFilter, riskFilter, timeRange]);

  const { data: auditData, isLoading: auditLoading } =
    useAuditLogs(auditQueryParams);

  const entries = auditData?.list ?? [];

  // 客户端关键字过滤
  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.actor.name.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.object.name.toLowerCase().includes(q) ||
        e.traceId.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const summary = useMemo(
    () => ({
      total: entries.length,
      success: entries.filter((e) => e.result === "success").length,
      failure: entries.filter(
        (e) => e.result === "failure" || e.result === "error",
      ).length,
      denied: entries.filter((e) => e.result === "denied").length,
      critical: entries.filter((e) => e.riskLevel === "critical").length,
      high: entries.filter((e) => e.riskLevel === "high").length,
    }),
    [entries],
  );

  const handleExport = () => {
    modal.confirm({
      title: `导出 ${filtered.length} 条审计日志？`,
      icon: <ExportOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>导出格式：CSV（脱敏字段保持脱敏）+ 签名清单（SHA-256）。</Text>
          <Alert
            type="info"
            showIcon
            message="导出范围"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 条目数：{filtered.length}</Text>
                <Text>
                  · 时间范围：
                  {timeRange
                    ? `${formatDate(timeRange[0])} ~ ${formatDate(timeRange[1])}`
                    : "全部"}
                </Text>
                <Text>· 脱敏字段：手机号、邮箱、文件路径</Text>
                <Text>· 大查询（&gt;10000 条）将转为异步任务，完成后通知</Text>
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认导出",
      cancelText: "取消",
      onOk: () => {
        message.success(
          `已开始导出 ${filtered.length} 条日志（V0 占位，下载链接将通过通知发送）`,
        );
      },
    });
  };

  const columns: ColumnsType<GovernanceAuditLog> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 160,
      fixed: "left",
      render: (ts: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(ts).toLocaleString("zh-CN")}
        </Text>
      ),
    },
    {
      title: "Actor",
      key: "actor",
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <Text strong>{record.actor.name}</Text>
            <Tag style={{ fontSize: 11 }}>
              {ACTOR_TYPE_LABEL[record.actor.type]}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.actor.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "动作",
      dataIndex: "action",
      key: "action",
      width: 180,
      render: (action: string, record) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 12 }}>
            {action}
          </Text>
          <Tag color={CATEGORY_COLOR[record.category]} style={{ fontSize: 11 }}>
            {CATEGORY_LABEL[record.category]}
          </Tag>
        </Space>
      ),
    },
    {
      title: "目标对象",
      key: "object",
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.object.name}
          </Text>
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.object.type}
            </Text>
            <Text code style={{ fontSize: 11 }}>
              {record.object.id}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Trace",
      dataIndex: "traceId",
      key: "traceId",
      width: 120,
      render: (t: string) => (
        <Text code style={{ fontSize: 11 }}>
          {t}
        </Text>
      ),
    },
    {
      title: "结果",
      dataIndex: "result",
      key: "result",
      width: 90,
      render: (r: GovernanceAuditLog["result"]) => (
        <Tag color={RESULT_COLOR[r]}>{RESULT_LABEL[r]}</Tag>
      ),
    },
    {
      title: "风险",
      dataIndex: "riskLevel",
      key: "riskLevel",
      width: 90,
      align: "center",
      render: (r: GovernanceAuditLog["riskLevel"]) => (
        <Tag color={RISK_COLOR[r]}>{r}</Tag>
      ),
    },
    {
      title: "脱敏",
      dataIndex: "masked",
      key: "masked",
      width: 80,
      align: "center",
      render: (m: boolean) =>
        m ? (
          <Tag color="orange" icon={<LockOutlined />}>
            是
          </Tag>
        ) : (
          <Tag>否</Tag>
        ),
    },
    {
      title: "操作",
      key: "action_btn",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedEntry(record);
            setDetailOpen(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <AuditOutlined style={{ marginRight: 8 }} />
            审计与证据
          </Title>
          <Text type="secondary">
            Governance · Audit/Evidence（D37.17）· 时间 / Actor / Object /
            Action / Trace 查询 · 证据包 export/seal/verify · 脱敏视图与 WORM
            存储
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="数据来源：Core Service AuditLog/EvidencePackage Controller"
        description="通过 BFF GovernanceProxyController 透传查询与写操作。脱敏字段在导出时保持脱敏状态。"
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "entries",
            label: (
              <span>
                <FileSearchOutlined /> 审计日志
              </span>
            ),
            children: (
              <>
                {/* 状态卡片 */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic title="日志总数" value={summary.total} />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="成功"
                        value={summary.success}
                        valueStyle={{ color: "#52c41a" }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="失败/错误"
                        value={summary.failure}
                        valueStyle={{ color: "#cf1322" }}
                        prefix={<ExclamationCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="拒绝"
                        value={summary.denied}
                        valueStyle={{ color: "#fa8c16" }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="高风险"
                        value={summary.high}
                        valueStyle={{ color: "#fa8c16" }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="关键风险"
                        value={summary.critical}
                        valueStyle={{ color: "#cf1322" }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 筛选 */}
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索 Actor / Action / Object / Trace ID..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Space wrap>
                      <Segmented
                        value={categoryFilter}
                        onChange={(v) => setCategoryFilter(v as string)}
                        options={[
                          { label: "全部", value: "all" },
                          { label: "认证", value: "auth" },
                          { label: "数据", value: "data" },
                          { label: "治理", value: "governance" },
                          { label: "AI", value: "ai" },
                          { label: "发布", value: "publication" },
                          { label: "系统", value: "admin" },
                        ]}
                      />
                      <Select
                        value={resultFilter}
                        onChange={setResultFilter}
                        style={{ width: 120 }}
                        options={[
                          { label: "全部结果", value: "all" },
                          { label: "成功", value: "success" },
                          { label: "失败", value: "failure" },
                          { label: "拒绝", value: "denied" },
                          { label: "错误", value: "error" },
                        ]}
                      />
                      <Select
                        value={riskFilter}
                        onChange={setRiskFilter}
                        style={{ width: 120 }}
                        options={[
                          { label: "全部风险", value: "all" },
                          { label: "低", value: "low" },
                          { label: "中", value: "medium" },
                          { label: "高", value: "high" },
                          { label: "关键", value: "critical" },
                        ]}
                      />
                      <Select
                        value={timePreset}
                        onChange={setTimePreset}
                        style={{ width: 140 }}
                        options={TIME_PRESETS.map((p) => ({
                          label: p.label,
                          value: p.value,
                        }))}
                      />
                      {timeRange && timeRange[0] && timeRange[1] && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(timeRange[0]).toLocaleString("zh-CN")} ~{" "}
                          {new Date(timeRange[1]).toLocaleString("zh-CN")}
                        </Text>
                      )}
                      <Button
                        type="primary"
                        icon={<ExportOutlined />}
                        onClick={handleExport}
                        disabled={filtered.length === 0}
                      >
                        导出（{filtered.length}）
                      </Button>
                    </Space>
                  </Space>
                </Card>

                <Card size="small">
                  <Spin spinning={auditLoading}>
                    <Table
                      rowKey="id"
                      columns={columns}
                      dataSource={filtered}
                      pagination={{ pageSize: 20 }}
                      scroll={{ x: 1400 }}
                      locale={{ emptyText: <Empty description="无审计日志" /> }}
                    />
                  </Spin>
                </Card>
              </>
            ),
          },
          {
            key: "evidence",
            label: (
              <span>
                <SafetyCertificateOutlined /> 证据包
              </span>
            ),
            children: <EvidenceTab />,
          },
        ]}
      />

      {/* 详情 Modal */}
      <Modal
        title={
          selectedEntry ? (
            <Space>
              <AuditOutlined />
              <Text>审计日志详情</Text>
              <Text code>{selectedEntry.id}</Text>
            </Space>
          ) : (
            "审计日志详情"
          )
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedEntry(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ]}
        width={720}
      >
        {selectedEntry && <EntryDetail entry={selectedEntry} />}
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * 数据通过 Core Service 查询；V1 接入后将支持 cursor
        分页和异步大查询。脱敏字段在详情和导出时保持脱敏。
      </Text>
    </Space>
  );
}

/** 日志详情 */
function EntryDetail({ entry }: { entry: GovernanceAuditLog }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="日志 ID">
          <Text code>{entry.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="时间">
          {new Date(entry.timestamp).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="Actor">
          <Space direction="vertical" size={0}>
            <Space>
              <Text strong>{entry.actor.name}</Text>
              <Tag>{ACTOR_TYPE_LABEL[entry.actor.type]}</Tag>
            </Space>
            <Text code style={{ fontSize: 11 }}>
              {entry.actor.id}
            </Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Action">
          <Text code>{entry.action}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color={CATEGORY_COLOR[entry.category]}>
            {CATEGORY_LABEL[entry.category]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="结果">
          <Tag color={RESULT_COLOR[entry.result]}>
            {RESULT_LABEL[entry.result]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="风险等级">
          <Tag color={RISK_COLOR[entry.riskLevel]}>{entry.riskLevel}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="脱敏">
          {entry.masked ? (
            <Tag color="orange" icon={<LockOutlined />}>
              字段已脱敏
            </Tag>
          ) : (
            <Tag color="green">无脱敏</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="目标对象" span={2}>
          <Space direction="vertical" size={0}>
            <Text strong>{entry.object.name}</Text>
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {entry.object.type}
              </Text>
              <Text code style={{ fontSize: 12 }}>
                {entry.object.id}
              </Text>
            </Space>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Trace ID" span={2}>
          <Text code>{entry.traceId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="IP 地址">{entry.ipAddress}</Descriptions.Item>
        <Descriptions.Item label="User Agent">
          <Text style={{ fontSize: 12 }}>{entry.userAgent}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="详情" span={2}>
          {entry.details}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}

/** 证据包 Tab */
function EvidenceTab() {
  const { message, modal } = App.useApp();
  const { data: evidenceData, isLoading } = useEvidencePackages({
    page: 1,
    pageSize: 100,
  });
  const actionMutation = useEvidencePackageAction();

  const packages = evidenceData?.list ?? [];

  const handleSeal = (pkg: GovernanceEvidencePackage) => {
    modal.confirm({
      title: `封存证据包 ${pkg.name}？`,
      icon: <LockOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>封存后证据包将写入 WORM 存储，不可修改或删除。</Text>
          <Alert
            type="info"
            showIcon
            message="封存影响"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 对象数：{pkg.items.length}</Text>
                <Text>· 哈希算法：SHA-256</Text>
                <Text>· 证据包 ID：{pkg.id}</Text>
                <Text type="secondary">封存后将生成证据包哈希和签名清单</Text>
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认封存",
      okType: "primary",
      cancelText: "取消",
      onOk: () => {
        actionMutation.mutate(
          {
            id: pkg.id,
            payload: {
              action: "seal",
              reason: "Manual seal from Audit/Evidence console",
              verifier: "current-user",
              signature: "V0-placeholder-signature",
            },
          },
          {
            onSuccess: () => {
              message.success(`${pkg.name} 已封存到 WORM 存储`);
            },
            onError: (err) => {
              message.error(`封存失败：${err.message}`);
            },
          },
        );
      },
    });
  };

  const handleVerify = (pkg: GovernanceEvidencePackage) => {
    message.loading({
      content: `正在验证 ${pkg.name}...`,
      key: "verify",
      duration: 1,
    });
    actionMutation.mutate(
      {
        id: pkg.id,
        payload: {
          action: "verify",
          reason: "Manual verify from Audit/Evidence console",
          verifier: "current-user",
          signature: "V0-placeholder-signature",
        },
      },
      {
        onSuccess: () => {
          message.success({
            content: `${pkg.name} 验证通过，哈希匹配`,
            key: "verify",
          });
        },
        onError: (err) => {
          message.error({
            content: `验证失败：${err.message}`,
            key: "verify",
          });
        },
      },
    );
  };

  const handleDownload = (pkg: GovernanceEvidencePackage) => {
    actionMutation.mutate(
      {
        id: pkg.id,
        payload: {
          action: "export",
          reason: "Manual export from Audit/Evidence console",
        },
      },
      {
        onSuccess: () => {
          message.info(`${pkg.name} 下载链接已生成（5 分钟有效）`);
        },
        onError: (err) => {
          message.error(`导出失败：${err.message}`);
        },
      },
    );
  };

  const columns: ColumnsType<GovernanceEvidencePackage> = [
    {
      title: "证据包",
      dataIndex: "name",
      key: "name",
      width: 240,
      fixed: "left",
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text code style={{ fontSize: 11 }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "创建",
      key: "created",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{new Date(record.createdAt).toLocaleString("zh-CN")}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            obj: {record.objectType} / {record.objectId}
          </Text>
        </Space>
      ),
    },
    {
      title: "封存",
      key: "sealed",
      width: 180,
      render: (_, record) =>
        record.sealedAt && record.sealedBy ? (
          <Space direction="vertical" size={0}>
            <Text>{new Date(record.sealedAt).toLocaleString("zh-CN")}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              by {record.sealedBy}
            </Text>
          </Space>
        ) : (
          <Tag>未封存</Tag>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: GovernanceEvidencePackage["status"]) => (
        <Tag color={EVIDENCE_STATUS_COLOR[s]}>{EVIDENCE_STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "对象数",
      key: "objectCount",
      width: 100,
      align: "right",
      render: (_, record) => (
        <Text strong>{record.items.length.toLocaleString()}</Text>
      ),
    },
    {
      title: "哈希",
      dataIndex: "hash",
      key: "hash",
      width: 180,
      render: (h: string) => (
        <Text code style={{ fontSize: 11 }}>
          {h}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 240,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<LockOutlined />}
            disabled={record.status !== "draft" || actionMutation.isPending}
            onClick={() => handleSeal(record)}
          >
            封存
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SafetyCertificateOutlined />}
            disabled={record.status === "draft" || actionMutation.isPending}
            onClick={() => handleVerify(record)}
          >
            验证
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            disabled={record.status === "draft" || actionMutation.isPending}
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={isLoading}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card size="small" title="证据包清单">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={packages}
            pagination={false}
            scroll={{ x: 1400 }}
            size="small"
            locale={{ emptyText: <Empty description="无证据包" /> }}
          />
        </Card>

        <Card size="small" title="证据包封存时间线">
          <Timeline
            items={packages.map((p) => ({
              color:
                p.status === "verified"
                  ? "green"
                  : p.status === "sealed"
                    ? "blue"
                    : "gray",
              children: (
                <Space direction="vertical" size={2}>
                  <Space>
                    <Text strong>{p.name}</Text>
                    <Tag
                      color={EVIDENCE_STATUS_COLOR[p.status]}
                      style={{ fontSize: 11 }}
                    >
                      {EVIDENCE_STATUS_LABEL[p.status]}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    创建：{new Date(p.createdAt).toLocaleString("zh-CN")} ·{" "}
                    {p.sealedAt &&
                      `封存：${new Date(p.sealedAt).toLocaleString("zh-CN")}`}
                  </Text>
                </Space>
              ),
            }))}
          />
        </Card>

        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          * 证据包封存后写入 WORM
          存储不可修改；验证时重新计算对象哈希与封存清单比对。导出脱敏字段保持脱敏。
        </Paragraph>
      </Space>
    </Spin>
  );
}
