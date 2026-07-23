"use client";

import { Card, Table, Tag, Button, Space, Typography, Modal, Form, Select, Spin, Alert, message, Descriptions, Statistic, Row, Col } from "antd";
import { PlusOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, EyeOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";

const { Title, Text } = Typography;

/** 检查结果状态 */
type CheckOutcome = "PASS" | "FAIL" | "NOT_APPLICABLE" | "INDETERMINATE" | "ERROR" | "MANUAL_REVIEW";

/** 检查运行 DTO */
interface ComplianceCheckRunDto {
  id: string;
  tenantId: string;
  projectId?: string;
  ruleSetId: string;
  status: string;
  outcomeSummary?: string;
  executions?: RuleExecutionDto[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  rowVersion: number;
}

/** 规则执行记录 */
interface RuleExecutionDto {
  id: string;
  ruleId: string;
  ruleCode: string;
  status: string;
  outcome: string;
  durationMs?: number;
  errorMessage?: string;
}

/** 检查结果 DTO */
interface CheckResultDto {
  id: string;
  executionId: string;
  objectId?: string;
  objectType?: string;
  outcome: CheckOutcome;
  measuredValue?: string;
  threshold?: string;
  explanation?: string;
  evidenceJson?: string;
  createdAt: string;
}

/** 创建检查运行请求 */
interface CreateCheckRunRequest {
  ruleSetId: string;
  projectId?: string;
}

/** 状态配置 */
const STATUS_CONFIG: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  PENDING: { label: "待执行", color: "default" },
  RUNNING: { label: "执行中", color: "processing" },
  COMPLETED: { label: "已完成", color: "success", icon: <CheckCircleOutlined /> },
  FAILED: { label: "失败", color: "error", icon: <CloseCircleOutlined /> },
  CANCELLED: { label: "已取消", color: "default" },
};

/** 结果状态配置 */
const OUTCOME_CONFIG: Record<CheckOutcome, { label: string; color: string; icon?: React.ReactNode }> = {
  PASS: { label: "通过", color: "success", icon: <CheckCircleOutlined /> },
  FAIL: { label: "未通过", color: "error", icon: <CloseCircleOutlined /> },
  NOT_APPLICABLE: { label: "不适用", color: "default" },
  INDETERMINATE: { label: "不确定", color: "warning", icon: <ExclamationCircleOutlined /> },
  ERROR: { label: "错误", color: "error" },
  MANUAL_REVIEW: { label: "待人工复核", color: "warning", icon: <ExclamationCircleOutlined /> },
};

/** 结果过滤选项 */
const OUTCOME_OPTIONS = Object.entries(OUTCOME_CONFIG).map(([value, { label }]) => ({ value, label }));

/** 查询检查运行列表 */
function useCheckRuns(params: { page: number; pageSize: number; projectId?: string }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.projectId) query.set("projectId", params.projectId);
  return useQuery<{ items: ComplianceCheckRunDto[]; total: number }>({
    queryKey: ["compliance-checks", params],
    queryFn: () => apiGet(`/api/v1/compliance-checks?${query.toString()}`),
  });
}

/** 查询单个检查运行详情 */
function useCheckRun(id?: string) {
  return useQuery<ComplianceCheckRunDto>({
    queryKey: ["compliance-check", id],
    queryFn: () => apiGet(`/api/v1/compliance-checks/${id}`),
    enabled: !!id,
  });
}

/** 查询检查结果 */
function useCheckResults(executionId?: string, outcome?: string) {
  return useQuery<{ items: CheckResultDto[]; total: number }>({
    queryKey: ["check-results", executionId, outcome],
    queryFn: () => {
      const query = new URLSearchParams({ page: "1", pageSize: "50" });
      if (outcome) query.set("outcome", outcome);
      return apiGet(`/api/v1/compliance-checks/executions/${executionId}/results?${query.toString()}`);
    },
    enabled: !!executionId,
  });
}

/** 创建检查运行 */
function useCreateCheckRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCheckRunRequest) => apiPost("/api/v1/compliance-checks", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-checks"] }),
  });
}

/** 执行检查 */
function useExecuteCheckRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/compliance-checks/${id}/execute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-checks"] }),
  });
}

export default function ComplianceChecksPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<string | undefined>();
  const [form] = Form.useForm<CreateCheckRunRequest>();

  const { data, isLoading, error } = useCheckRuns({ page, pageSize });
  const createMutation = useCreateCheckRun();
  const executeMutation = useExecuteCheckRun();

  const { data: selectedRun } = useCheckRun(selectedRunId);
  const firstExecutionId = selectedRun?.executions?.[0]?.id;
  const { data: resultsData, isLoading: resultsLoading } = useCheckResults(firstExecutionId, outcomeFilter);

  const handleCreate = (values: CreateCheckRunRequest) => {
    createMutation.mutate(values, {
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
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const config = STATUS_CONFIG[status] ?? { label: status, color: "default" };
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
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
      width: 200,
      render: (_: unknown, record: ComplianceCheckRunDto) => (
        <Space>
          {(record.status === "PENDING" || record.status === "FAILED") && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={executeMutation.isPending && executeMutation.variables === record.id}
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
        </Space>
      ),
    },
  ];

  if (error) {
    return <Alert type="error" message="加载失败" description={(error as Error).message} />;
  }

  // 计算结果统计
  const results = resultsData?.items ?? [];
  const passCount = results.filter((r) => r.outcome === "PASS").length;
  const failCount = results.filter((r) => r.outcome === "FAIL").length;
  const reviewCount = results.filter((r) => r.outcome === "MANUAL_REVIEW").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4}>合规检查运行</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          创建检查运行
        </Button>
      </div>

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
              onChange: (p, s) => { setPage(p); setPageSize(s); },
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
        onCancel={() => { setCreateModalVisible(false); form.resetFields(); }}
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
              // 实际项目中应从 API 加载规则集列表，此处简化为手动输入
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
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
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
        onCancel={() => { setDetailModalVisible(false); setSelectedRunId(undefined); }}
        footer={null}
        width={900}
      >
        {selectedRun && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检查运行 ID" span={2}>
                <Text code>{selectedRun.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="规则集 ID">
                <Text code>{selectedRun.ruleSetId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="项目 ID">
                {selectedRun.projectId ? <Text code>{selectedRun.projectId}</Text> : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const config = STATUS_CONFIG[selectedRun.status] ?? { label: selectedRun.status, color: "default" };
                  return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="结果摘要">
                {selectedRun.outcomeSummary || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {selectedRun.startedAt ? new Date(selectedRun.startedAt).toLocaleString("zh-CN") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString("zh-CN") : "-"}
              </Descriptions.Item>
            </Descriptions>

            {selectedRun.executions && selectedRun.executions.length > 0 && (
              <Card size="small" title="规则执行记录" style={{ marginBottom: 16 }}>
                {selectedRun.executions.map((exec) => {
                  const config = OUTCOME_CONFIG[exec.outcome as CheckOutcome] ?? { label: exec.outcome, color: "default" };
                  return (
                    <Tag
                      key={exec.id}
                      color={config.color}
                      icon={config.icon}
                      style={{ marginBottom: 4 }}
                    >
                      {exec.ruleCode}: {config.label}
                      {exec.durationMs ? ` (${exec.durationMs}ms)` : ""}
                    </Tag>
                  );
                })}
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
                    <Statistic title="通过" value={passCount} valueStyle={{ color: "#52c41a" }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic title="未通过" value={failCount} valueStyle={{ color: "#ff4d4f" }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic title="待人工复核" value={reviewCount} valueStyle={{ color: "#faad14" }} />
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
            <Table
              size="small"
              loading={resultsLoading}
              columns={[
                {
                  title: "结果",
                  dataIndex: "outcome",
                  key: "outcome",
                  width: 120,
                  render: (outcome: CheckOutcome) => {
                    const config = OUTCOME_CONFIG[outcome] ?? { label: outcome, color: "default" };
                    return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
                  },
                },
                { title: "对象类型", dataIndex: "objectType", key: "objectType", width: 100 },
                { title: "测量值", dataIndex: "measuredValue", key: "measuredValue", ellipsis: true },
                { title: "阈值", dataIndex: "threshold", key: "threshold", ellipsis: true },
                { title: "说明", dataIndex: "explanation", key: "explanation", ellipsis: true },
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
