"use client";

import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Select,
  Spin,
  App,
  Descriptions,
  Statistic,
  Row,
  Col,
  Alert,
} from "antd";
import {
  PlusOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ComplianceCheckRunDto,
  CheckResultDto,
  CreateCheckRunRequest,
} from "@design-platform/shared";
import {
  CHECK_RUN_STATUS_LABEL,
  CHECK_RUN_STATUS_TAG_COLOR,
  OUTCOME_LABEL,
  OUTCOME_TAG_COLOR,
} from "@design-platform/shared";
import {
  useComplianceCheckRuns,
  useComplianceCheckRun,
  useCheckResults,
  useCreateComplianceCheckRun,
  useExecuteComplianceCheckRun,
} from "@/hooks/use-compliance";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text } = Typography;

/** 检查结果状态 */
type CheckOutcome = CheckResultDto["outcome"];

/** 状态配置 */
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon?: React.ReactNode }
> = {
  PENDING: {
    label: CHECK_RUN_STATUS_LABEL.PENDING ?? "PENDING",
    color: CHECK_RUN_STATUS_TAG_COLOR.PENDING ?? "default",
  },
  RUNNING: {
    label: CHECK_RUN_STATUS_LABEL.RUNNING ?? "RUNNING",
    color: CHECK_RUN_STATUS_TAG_COLOR.RUNNING ?? "default",
    icon: <PlayCircleOutlined />,
  },
  COMPLETED: {
    label: CHECK_RUN_STATUS_LABEL.COMPLETED ?? "COMPLETED",
    color: CHECK_RUN_STATUS_TAG_COLOR.COMPLETED ?? "default",
    icon: <CheckCircleOutlined />,
  },
  FAILED: {
    label: CHECK_RUN_STATUS_LABEL.FAILED ?? "FAILED",
    color: CHECK_RUN_STATUS_TAG_COLOR.FAILED ?? "default",
    icon: <CloseCircleOutlined />,
  },
  CANCELLED: {
    label: CHECK_RUN_STATUS_LABEL.CANCELLED ?? "CANCELLED",
    color: CHECK_RUN_STATUS_TAG_COLOR.CANCELLED ?? "default",
  },
};

/** 结果状态配置 */
const OUTCOME_CONFIG: Record<
  CheckOutcome,
  { label: string; color: string; icon?: React.ReactNode }
> = {
  PASS: {
    label: OUTCOME_LABEL.PASS ?? "PASS",
    color: OUTCOME_TAG_COLOR.PASS ?? "default",
    icon: <CheckCircleOutlined />,
  },
  FAIL: {
    label: OUTCOME_LABEL.FAIL ?? "FAIL",
    color: OUTCOME_TAG_COLOR.FAIL ?? "default",
    icon: <CloseCircleOutlined />,
  },
  NOT_APPLICABLE: {
    label: OUTCOME_LABEL.NOT_APPLICABLE ?? "NOT_APPLICABLE",
    color: OUTCOME_TAG_COLOR.NOT_APPLICABLE ?? "default",
  },
  INDETERMINATE: {
    label: OUTCOME_LABEL.INDETERMINATE ?? "INDETERMINATE",
    color: OUTCOME_TAG_COLOR.INDETERMINATE ?? "default",
    icon: <ExclamationCircleOutlined />,
  },
  ERROR: {
    label: OUTCOME_LABEL.ERROR ?? "ERROR",
    color: OUTCOME_TAG_COLOR.ERROR ?? "default",
  },
  MANUAL_REVIEW: {
    label: OUTCOME_LABEL.MANUAL_REVIEW ?? "MANUAL_REVIEW",
    color: OUTCOME_TAG_COLOR.MANUAL_REVIEW ?? "default",
    icon: <ExclamationCircleOutlined />,
  },
};

/** 结果过滤选项 */
const OUTCOME_OPTIONS = Object.entries(OUTCOME_CONFIG).map(
  ([value, { label }]) => ({ value, label }),
);

/** 创建检查运行表单值（Select tags 模式产生 string[]） */
interface CheckRunFormValues {
  ruleSetId: string[];
  projectId?: string[];
}

export default function ComplianceChecksPage() {
  const { message } = App.useApp();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<string | undefined>();
  const [form] = Form.useForm<CheckRunFormValues>();

  const { data, isLoading, error } = useComplianceCheckRuns({ page, pageSize });
  const createMutation = useCreateComplianceCheckRun();
  const executeMutation = useExecuteComplianceCheckRun();

  const { data: selectedRun } = useComplianceCheckRun(selectedRunId);
  const firstExecutionId = selectedRun?.executions?.[0]?.id;
  const { data: resultsData, isLoading: resultsLoading } = useCheckResults(
    firstExecutionId,
    { page: 1, pageSize: 50, outcome: outcomeFilter },
  );

  const handleCreate = (values: CheckRunFormValues) => {
    const ruleSetId = values.ruleSetId?.[0];
    if (!ruleSetId) {
      message.error("请输入规则集 ID");
      return;
    }
    const payload: CreateCheckRunRequest = {
      ruleSetId,
      projectId: values.projectId?.[0],
    };
    createMutation.mutate(payload, {
      onSuccess: () => {
        message.success("检查运行已创建，可点击执行启动检查");
        setCreateModalVisible(false);
        form.resetFields();
      },
      onError: (err: Error) => message.error(`创建失败: ${err.message}`),
    });
  };

  const handleExecute = (id: string) => {
    executeMutation.mutate(id, {
      onSuccess: () => message.success("检查执行已启动"),
      onError: (err: Error) => message.error(`执行失败: ${err.message}`),
    });
  };

  const columns = [
    {
      title: "检查运行 ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },
    {
      title: "规则集 ID",
      dataIndex: "ruleSetId",
      key: "ruleSetId",
      width: 120,
      render: (id?: string) =>
        id ? <Text code>{id.slice(0, 8)}...</Text> : "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const config = STATUS_CONFIG[status] ?? {
          label: status,
          color: "default",
        };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "结果摘要",
      dataIndex: "outcomeSummary",
      key: "outcomeSummary",
      ellipsis: true,
      render: (summary?: string) => summary || "-",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      render: (_: unknown, record: ComplianceCheckRunDto) => (
        <Space>
          {(record.status === "PENDING" || record.status === "FAILED") && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={
                executeMutation.isPending &&
                executeMutation.variables === record.id
              }
              onClick={() => handleExecute(record.id)}
            >
              执行
            </Button>
          )}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRunId(record.id);
              setOutcomeFilter(undefined);
              setDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          <Button
            size="small"
            type="link"
            icon={<FileSearchOutlined />}
            onClick={() => router.push(`/compliance-results/${record.id}`)}
            title="打开 P08 规则检查与规范证据审阅器"
          >
            P08 审阅
          </Button>
        </Space>
      ),
    },
  ];

  if (error) {
    return <DataErrorAlert error={error} context="合规检查运行列表" />;
  }

  // 计算结果统计
  const results = resultsData?.items ?? [];
  const passCount = results.filter((r) => r.outcome === "PASS").length;
  const failCount = results.filter((r) => r.outcome === "FAIL").length;
  const reviewCount = results.filter(
    (r) => r.outcome === "MANUAL_REVIEW",
  ).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4}>合规检查运行</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          创建检查运行
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="P08 规则检查与规范证据审阅器已就绪"
        description={
          <span>
            点击列表行的「P08 审阅」按钮可打开 D37.12 P08
            完整审阅器，包含覆盖率面板、结果树、结果详情、Exception
            草稿表单等核心组件。
          </span>
        }
      />

      <Card>
        <Spin spinning={isLoading}>
          <Table
            columns={columns}
            dataSource={data?.items}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total: data?.total ?? 0,
              onChange: (p, s) => {
                setPage(p);
                setPageSize(s);
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个检查运行`,
            }}
            bordered
          />
        </Spin>
      </Card>

      {/* 创建检查运行弹窗 */}
      <Modal
        title="创建合规检查运行"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="ruleSetId"
            label="规则集 ID"
            rules={[{ required: true, message: "请输入规则集 ID" }]}
          >
            <Select
              showSearch
              placeholder="选择或输入规则集 ID"
              notFoundContent="请输入规则集 UUID"
              filterOption={false}
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
          <Form.Item name="projectId" label="项目 ID（可选）">
            <Select
              showSearch
              placeholder="选择或输入项目 ID"
              notFoundContent="请输入项目 UUID"
              filterOption={false}
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 检查运行详情弹窗 */}
      <Modal
        title="检查运行详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedRunId(undefined);
        }}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<FileSearchOutlined />}
              onClick={() => {
                if (selectedRunId) {
                  setDetailModalVisible(false);
                  router.push(`/compliance-results/${selectedRunId}`);
                }
              }}
            >
              打开 P08 审阅器
            </Button>
            <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
          </Space>
        }
        width={900}
      >
        {selectedRun && (
          <>
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="检查运行 ID" span={2}>
                <Text code>{selectedRun.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="规则集 ID">
                <Text code>{selectedRun.ruleSetId ?? "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="项目 ID">
                {selectedRun.projectId ? (
                  <Text code>{selectedRun.projectId}</Text>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const config = STATUS_CONFIG[selectedRun.status] ?? {
                    label: selectedRun.status,
                    color: "default",
                  };
                  return (
                    <Tag color={config.color} icon={config.icon}>
                      {config.label}
                    </Tag>
                  );
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="结果摘要">
                {selectedRun.outcomeSummary || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {selectedRun.startedAt
                  ? new Date(selectedRun.startedAt).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {selectedRun.completedAt
                  ? new Date(selectedRun.completedAt).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
            </Descriptions>

            {selectedRun.executions && selectedRun.executions.length > 0 && (
              <Card
                size="small"
                title="规则执行记录"
                style={{ marginBottom: 16 }}
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={selectedRun.executions}
                  columns={[
                    {
                      title: "规则修订",
                      dataIndex: "revisionId",
                      key: "revisionId",
                      width: 120,
                      render: (id: string) => (
                        <Text code>{id?.slice(0, 8) ?? "-"}...</Text>
                      ),
                    },
                    {
                      title: "状态",
                      dataIndex: "status",
                      key: "status",
                      width: 100,
                      render: (status: string) => {
                        const config = STATUS_CONFIG[status] ?? {
                          label: status,
                          color: "default",
                        };
                        return (
                          <Tag color={config.color} icon={config.icon}>
                            {config.label}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: "适用",
                      dataIndex: "applicabilityCount",
                      key: "applicabilityCount",
                      width: 70,
                      align: "center" as const,
                    },
                    {
                      title: "通过",
                      dataIndex: "passCount",
                      key: "passCount",
                      width: 70,
                      align: "center" as const,
                      render: (v: number) => (
                        <Text style={{ color: "#52c41a" }}>{v}</Text>
                      ),
                    },
                    {
                      title: "未通过",
                      dataIndex: "failCount",
                      key: "failCount",
                      width: 70,
                      align: "center" as const,
                      render: (v: number) => (
                        <Text style={{ color: "#ff4d4f" }}>{v}</Text>
                      ),
                    },
                    {
                      title: "不适用",
                      dataIndex: "notApplicableCount",
                      key: "notApplicableCount",
                      width: 70,
                      align: "center" as const,
                    },
                    {
                      title: "待复核",
                      dataIndex: "manualReviewCount",
                      key: "manualReviewCount",
                      width: 70,
                      align: "center" as const,
                      render: (v: number) =>
                        v > 0 ? (
                          <Text style={{ color: "#faad14" }}>{v}</Text>
                        ) : (
                          v
                        ),
                    },
                    {
                      title: "异常",
                      dataIndex: "errorCount",
                      key: "errorCount",
                      width: 70,
                      align: "center" as const,
                      render: (v: number) =>
                        v > 0 ? (
                          <Text style={{ color: "#ff4d4f" }}>{v}</Text>
                        ) : (
                          v
                        ),
                    },
                    {
                      title: "耗时",
                      dataIndex: "durationMs",
                      key: "durationMs",
                      width: 80,
                      render: (ms?: number | null) =>
                        ms != null ? `${ms}ms` : "-",
                    },
                  ]}
                />
              </Card>
            )}

            {/* 结果统计 */}
            {results.length > 0 && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic title="总检查项" value={results.length} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="通过"
                      value={passCount}
                      valueStyle={{ color: "#52c41a" }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="未通过"
                      value={failCount}
                      valueStyle={{ color: "#ff4d4f" }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="待人工复核"
                      value={reviewCount}
                      valueStyle={{ color: "#faad14" }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {/* 结果列表 */}
            <div style={{ marginBottom: 8 }}>
              <Space>
                <Text strong>检查结果明细</Text>
                <Select
                  placeholder="按结果筛选"
                  allowClear
                  style={{ width: 150 }}
                  options={OUTCOME_OPTIONS}
                  value={outcomeFilter}
                  onChange={setOutcomeFilter}
                />
              </Space>
            </div>
            <Table<CheckResultDto>
              size="small"
              loading={resultsLoading}
              columns={[
                {
                  title: "结果",
                  dataIndex: "outcome",
                  key: "outcome",
                  width: 120,
                  render: (outcome: CheckOutcome) => {
                    const config = OUTCOME_CONFIG[outcome] ?? {
                      label: outcome,
                      color: "default",
                    };
                    return (
                      <Tag color={config.color} icon={config.icon}>
                        {config.label}
                      </Tag>
                    );
                  },
                },
                {
                  title: "对象类型",
                  dataIndex: "objectType",
                  key: "objectType",
                  width: 100,
                },
                {
                  title: "测量值",
                  dataIndex: "measuredValue",
                  key: "measuredValue",
                  ellipsis: true,
                },
                {
                  title: "阈值",
                  dataIndex: "threshold",
                  key: "threshold",
                  ellipsis: true,
                },
                {
                  title: "说明",
                  dataIndex: "explanation",
                  key: "explanation",
                  ellipsis: true,
                },
              ]}
              dataSource={results}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              bordered
            />
          </>
        )}
      </Modal>
    </div>
  );
}
