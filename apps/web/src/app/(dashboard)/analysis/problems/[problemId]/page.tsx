"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  List,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  FunctionOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined,
  BranchesOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  AnalysisProblemDto,
  AnalysisProblemType,
  AnalysisResultDto,
  AnalysisScenarioDto,
  ConvergenceMetricDto,
  MeshQualityDto,
  ProblemStatus,
  QualityDecision,
  ResultQualityAssessmentDto,
  ResultQualityStatus,
  RunStatus,
  RunTimelineEventDto,
  SolverProfileDto,
} from "@design-platform/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAnalysisProblem,
  useAnalysisScenarios,
  useCreateImpactProposal,
  useCreateSimulationRun,
  useMeshQuality,
  useResultQuality,
  useRunConvergence,
  useRunResults,
  useRunTimeline,
  useSolverProfiles,
  useSubmitQualityAssessment,
} from "@/hooks/use-analysis";

const { Title, Text, Paragraph } = Typography;

// ── 标签映射 ──

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

const QUALITY_LABEL: Record<ResultQualityStatus, string> = {
  PENDING: "待审查",
  VALID: "有效",
  QUESTIONABLE: "可疑",
  INVALID: "无效",
  SUPERSEDED: "已取代",
};

const QUALITY_COLOR: Record<ResultQualityStatus, string> = {
  PENDING: "default",
  VALID: "success",
  QUESTIONABLE: "warning",
  INVALID: "error",
  SUPERSEDED: "blue",
};

const DECISION_LABEL: Record<QualityDecision, string> = {
  ACCEPT_AS_DRAFT: "接受为草稿",
  ACCEPT_AS_REVISION: "接受为修订",
  REJECT: "拒绝",
  ESCALATE: "上报",
  EXCEPTION: "例外批准",
};

const DECISION_COLOR: Record<QualityDecision, string> = {
  ACCEPT_AS_DRAFT: "blue",
  ACCEPT_AS_REVISION: "success",
  REJECT: "error",
  ESCALATE: "warning",
  EXCEPTION: "purple",
};

const TIMELINE_ICON_MAP: Record<RunTimelineEventDto["type"], React.ReactNode> =
  {
    queued: <ThunderboltOutlined />,
    license_acquired: <CheckCircleOutlined />,
    preparing: <ExperimentOutlined />,
    solver_started: <PlayCircleOutlined />,
    checkpoint: <ApartmentOutlined />,
    iteration: <FunctionOutlined />,
    converged: <CheckCircleOutlined />,
    diverged: <WarningOutlined />,
    post_processing: <BarChartOutlined />,
    completed: <CheckCircleOutlined />,
    failed: <ExclamationCircleOutlined />,
    cancelled: <ExclamationCircleOutlined />,
    log: <FileSearchOutlined />,
    warning: <WarningOutlined />,
    error: <ExclamationCircleOutlined />,
  };

// ── 详情页组件 ──

export default function AnalysisProblemDetailPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = use(params);
  const router = useRouter();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("problem");

  // 数据查询
  const { data: problem, isLoading, refetch } = useAnalysisProblem(problemId);
  const { data: scenarios } = useAnalysisScenarios(problemId);
  const { data: meshQuality } = useMeshQuality(problemId);
  const { data: solverProfiles } = useSolverProfiles();

  // 主动作 mutation（对齐 D37.14 §主动作）
  const createRunMutation = useCreateSimulationRun();
  const submitQualityMutation = useSubmitQualityAssessment();
  const createImpactProposalMutation = useCreateImpactProposal();

  // 最近运行 ID（V0：若 problem 尚未关联运行，则不查询运行相关数据）
  const latestRunId = problem?.latestRunId ?? null;
  const { data: timeline } = useRunTimeline(latestRunId);
  const { data: convergence } = useRunConvergence(latestRunId);
  const { data: results } = useRunResults(latestRunId);

  const latestResult = useMemo<AnalysisResultDto | null>(
    () => (results && results.length > 0 ? (results[0] ?? null) : null),
    [results],
  );

  // 质量评估（调用真实 API：GET /api/v1/analysis/results/{resultId}/quality）
  const { data: qualityAssessment } = useResultQuality(
    latestResult?.id ?? null,
  );

  if (isLoading) {
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

  if (!problem) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="未找到工程分析问题"
        style={{ padding: 48 }}
      >
        <Button type="primary" onClick={() => router.push("/analysis")}>
          返回列表
        </Button>
      </Empty>
    );
  }

  // 主动作可用性判断
  const canRun = problem.status === "READY" || problem.status === "COMPLETED";
  const canSubmitQuality =
    problem.status === "COMPLETED" &&
    latestResult?.qualityStatus === "QUESTIONABLE";
  const canCreateImpactProposal =
    latestResult?.qualityStatus === "VALID" ||
    latestResult?.qualityStatus === "QUESTIONABLE";

  // 主动作 handler：通过 Modal.confirm 收集输入并调用真实 API
  const handleRunScenario = () => {
    if (!problem) return;
    const scenarioOptions = (scenarios ?? []).map((s) => ({
      label: `${s.name} (${s.id.slice(0, 8)})`,
      value: s.id,
    }));
    const solverOptions = (solverProfiles ?? []).map((p) => ({
      label: `${p.name} (${p.solverType})`,
      value: p.id,
    }));
    if (scenarioOptions.length === 0) {
      message.warning("当前问题暂无场景，请先创建场景");
      return;
    }
    if (solverOptions.length === 0) {
      message.warning("当前没有可用 Solver Profile");
      return;
    }
    let selectedScenarioId = scenarioOptions[0]?.value ?? "";
    let selectedSolverProfileId = solverOptions[0]?.value ?? "";
    modal.confirm({
      title: "运行 Scenario",
      content: (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text>选择场景与求解器配置后将进入运行队列。</Text>
          <div>
            <Text type="secondary">Scenario</Text>
            <Select
              style={{ width: "100%" }}
              defaultValue={selectedScenarioId}
              options={scenarioOptions}
              onChange={(v) => (selectedScenarioId = v)}
            />
          </div>
          <div>
            <Text type="secondary">Solver Profile</Text>
            <Select
              style={{ width: "100%" }}
              defaultValue={selectedSolverProfileId}
              options={solverOptions}
              onChange={(v) => (selectedSolverProfileId = v)}
            />
          </div>
        </Space>
      ),
      okText: "提交运行",
      cancelText: "取消",
      onOk: async () => {
        if (!selectedScenarioId || !selectedSolverProfileId) {
          message.error("请选择 Scenario 与 Solver Profile");
          return Promise.reject();
        }
        try {
          const run = await createRunMutation.mutateAsync({
            problemId: problem.id,
            scenarioId: selectedScenarioId,
            solverProfileId: selectedSolverProfileId,
          });
          message.success(
            `运行已创建（${run.id.slice(0, 8)}），状态：${run.status}`,
          );
          void queryClient.invalidateQueries({
            queryKey: ["analysis", "problems", "detail", problem.id],
          });
        } catch (err) {
          message.error(
            `运行创建失败：${err instanceof Error ? err.message : "未知错误"}`,
          );
          throw err;
        }
      },
    });
  };

  const handleSubmitQuality = () => {
    if (!problem || !latestResult) return;
    let decision: QualityDecision = "ACCEPT_AS_DRAFT";
    let reason = "";
    let reviewer = problem.owner ?? "";
    let reviewerRole = problem.ownerRole ?? "";
    modal.confirm({
      title: "提交结果质量评估",
      content: (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text>
            决策 ACCEPT_AS_REVISION / EXCEPTION 需注册师签章（安全红线）。
          </Text>
          <div>
            <Text type="secondary">决策</Text>
            <Select
              style={{ width: "100%" }}
              defaultValue={decision}
              options={[
                {
                  label: "接受为草稿 (ACCEPT_AS_DRAFT)",
                  value: "ACCEPT_AS_DRAFT",
                },
                {
                  label: "接受为修订 (ACCEPT_AS_REVISION)",
                  value: "ACCEPT_AS_REVISION",
                },
                { label: "拒绝 (REJECT)", value: "REJECT" },
                { label: "上报 (ESCALATE)", value: "ESCALATE" },
                { label: "例外批准 (EXCEPTION)", value: "EXCEPTION" },
              ]}
              onChange={(v) => (decision = v)}
            />
          </div>
          <div>
            <Text type="secondary">评估人</Text>
            <Select
              style={{ width: "100%" }}
              defaultValue={reviewer}
              options={[{ label: reviewer || "—", value: reviewer }]}
              onChange={(v) => (reviewer = v)}
            />
          </div>
          <div>
            <Text type="secondary">评估理由</Text>
            <Input.TextArea
              rows={3}
              placeholder="说明评估依据、检查项、风险..."
              onChange={(e) => (reason = e.target.value)}
            />
          </div>
        </Space>
      ),
      okText: "提交评估",
      cancelText: "取消",
      onOk: async () => {
        if (!reason.trim()) {
          message.error("请填写评估理由");
          return Promise.reject();
        }
        try {
          await submitQualityMutation.mutateAsync({
            resultId: latestResult.id,
            data: {
              decision,
              reviewer,
              reviewerRole,
              reason,
            },
          });
          message.success("质量评估已提交");
          void queryClient.invalidateQueries({
            queryKey: ["analysis", "results", "quality", latestResult.id],
          });
        } catch (err) {
          message.error(
            `评估提交失败：${err instanceof Error ? err.message : "未知错误"}`,
          );
          throw err;
        }
      },
    });
  };

  const handleCreateImpactProposal = () => {
    if (!problem || !latestResult) return;
    let description = "";
    modal.confirm({
      title: "创建变更影响提案",
      content: (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text>
            基于结果创建变更提案，需 stepUpToken 二次认证（安全红线）。
          </Text>
          <div>
            <Text type="secondary">变更描述</Text>
            <Input.TextArea
              rows={3}
              placeholder="说明变更范围、影响对象、原因..."
              onChange={(e) => (description = e.target.value)}
            />
          </div>
        </Space>
      ),
      okText: "创建提案",
      cancelText: "取消",
      onOk: async () => {
        if (!description.trim()) {
          message.error("请填写变更描述");
          return Promise.reject();
        }
        try {
          const result = await createImpactProposalMutation.mutateAsync({
            resultId: latestResult.id,
            data: { description, problemId: problem.id },
          });
          message.success(`变更提案已创建（${result.proposalId.slice(0, 8)}）`);
        } catch (err) {
          message.error(
            `创建提案失败：${err instanceof Error ? err.message : "未知错误"}`,
          );
          throw err;
        }
      },
    });
  };

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
          onClick={() => router.push("/analysis")}
          style={{ paddingLeft: 0 }}
        >
          返回工程分析列表
        </Button>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
            刷新
          </Button>
        </Space>
      </div>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="工程分析域已对接后端 API"
        description="AnalysisProblem / Scenario / Run / Result / SolverProfile API 已由 Core Service 提供。若后端未启动或返回 404/501，相关面板将显示空状态。"
      />

      {/* Problem Header（对齐 D37.14） */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {/* 第一行：标题 + 状态 */}
          <Space align="center" wrap>
            <Title level={3} style={{ margin: 0 }}>
              <ExperimentOutlined style={{ marginRight: 8 }} />
              {problem.title}
            </Title>
            <Tag color={STATUS_COLOR[problem.status]}>
              {STATUS_LABEL[problem.status]}
            </Tag>
            <Tag color={TYPE_COLOR[problem.type]}>
              {TYPE_LABEL[problem.type]}
            </Tag>
            {problem.requiresHumanReview && (
              <Tooltip title="需要人工复核">
                <Tag color="warning" icon={<WarningOutlined />}>
                  需复核
                </Tag>
              </Tooltip>
            )}
            {problem.isAiAssisted && (
              <Tag color="purple" icon={<SafetyCertificateOutlined />}>
                AI 辅助
              </Tag>
            )}
          </Space>

          {/* 第二行：基本信息 */}
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 4 }}
            style={{ margin: 0 }}
          >
            <Descriptions.Item label="编号">
              <Text code copyable>
                {problem.code}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="负责人">
              <Space size={4}>
                <Text>{problem.owner}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ({problem.ownerRole})
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="所属项目">
              <Text>{problem.projectName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Baseline">
              <Tooltip title={problem.baselineHash}>
                <Text code>{problem.baselineId}</Text>
              </Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="输入完整度">
              <Progress
                percent={problem.inputCompleteness}
                size="small"
                status={
                  problem.inputCompleteness >= 100
                    ? "success"
                    : problem.inputCompleteness >= 80
                      ? "active"
                      : "exception"
                }
                style={{ width: 160 }}
              />
            </Descriptions.Item>
            <Descriptions.Item label="假设条目">
              <Tag color="blue">{problem.assumptionCount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="边界条件">
              <Tag color="blue">{problem.boundaryConditionCount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="荷载工况">
              <Tag color="blue">{problem.loadCaseCount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="运行次数">
              <Tag color={problem.runCount > 0 ? "blue" : "default"}>
                {problem.runCount}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最近运行状态">
              {problem.latestRunStatus ? (
                <Tag color={RUN_STATUS_COLOR[problem.latestRunStatus]}>
                  {RUN_STATUS_LABEL[problem.latestRunStatus]}
                </Tag>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="结果质量">
              {problem.latestResultQuality ? (
                <Tag color={QUALITY_COLOR[problem.latestResultQuality]}>
                  {QUALITY_LABEL[problem.latestResultQuality]}
                </Tag>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(problem.updatedAt).toLocaleString("zh-CN")}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          {/* 第三行：描述 */}
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {problem.description}
          </Paragraph>
        </Space>
      </Card>

      {/* Tabs 主体（对齐 D37.14 §布局） */}
      <Card size="small" bodyStyle={{ padding: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "problem",
              label: (
                <span>
                  <FileSearchOutlined /> 问题概要
                </span>
              ),
              children: <ProblemOverviewPanel problem={problem} />,
            },
            {
              key: "input",
              label: (
                <span>
                  <ApartmentOutlined /> 输入 / 假设 / BC / Load
                </span>
              ),
              children: (
                <InputPanel
                  problem={problem}
                  meshQuality={meshQuality ?? null}
                />
              ),
            },
            {
              key: "scenario",
              label: (
                <span>
                  <FunctionOutlined /> 场景 / Solver
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {scenarios?.length ?? 0}
                  </Tag>
                </span>
              ),
              children: (
                <ScenarioPanel
                  scenarios={scenarios ?? []}
                  solverProfiles={solverProfiles ?? []}
                />
              ),
            },
            {
              key: "run",
              label: (
                <span>
                  <ThunderboltOutlined /> 运行监控
                  {problem.latestRunStatus && (
                    <Tag
                      color={RUN_STATUS_COLOR[problem.latestRunStatus]}
                      style={{ marginLeft: 4 }}
                    >
                      {RUN_STATUS_LABEL[problem.latestRunStatus]}
                    </Tag>
                  )}
                </span>
              ),
              children: (
                <RunMonitorPanel
                  runId={latestRunId}
                  timeline={timeline ?? []}
                  convergence={convergence ?? []}
                  runStatus={problem.latestRunStatus}
                />
              ),
            },
            {
              key: "result",
              label: (
                <span>
                  <BarChartOutlined /> 结果 / 指标
                  {latestResult && (
                    <Tag
                      color={QUALITY_COLOR[latestResult.qualityStatus]}
                      style={{ marginLeft: 4 }}
                    >
                      {QUALITY_LABEL[latestResult.qualityStatus]}
                    </Tag>
                  )}
                </span>
              ),
              children: <ResultViewerPanel result={latestResult} />,
            },
            {
              key: "quality",
              label: (
                <span>
                  <SafetyCertificateOutlined /> 质量 / 证据
                </span>
              ),
              children: (
                <QualityRailPanel
                  assessment={qualityAssessment}
                  result={latestResult}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 底部主动作（对齐 D37.14 §主动作） */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="完成进程不等于接受结果"
            description="AI/规则/分析只提供候选、Finding 或证据。完成运行后须由具备资质的人员完成质量评估与接受决策，且接受率/置信分不得单独决定发布。"
          />
          <Space wrap size="middle">
            <Tooltip
              title={
                canRun
                  ? "运行选定的 Scenario，进入队列"
                  : "当前状态不允许运行（需 Ready / Completed）"
              }
            >
              <Button
                type="primary"
                disabled={!canRun}
                loading={createRunMutation.isPending}
                icon={<PlayCircleOutlined />}
                onClick={handleRunScenario}
              >
                运行 Scenario
              </Button>
            </Tooltip>
            <Tooltip
              title={
                canSubmitQuality
                  ? "提交结果质量评估与决策"
                  : "需先有可疑结果待审查"
              }
            >
              <Button
                type="primary"
                disabled={!canSubmitQuality}
                loading={submitQualityMutation.isPending}
                icon={<SafetyCertificateOutlined />}
                onClick={handleSubmitQuality}
              >
                提交结果质量评估
              </Button>
            </Tooltip>
            <Tooltip
              title={
                canCreateImpactProposal
                  ? "基于结果创建变更提案"
                  : "需先有有效或可疑结果"
              }
            >
              <Button
                type="default"
                disabled={!canCreateImpactProposal}
                loading={createImpactProposalMutation.isPending}
                icon={<BranchesOutlined />}
                onClick={handleCreateImpactProposal}
              >
                创建变更提案
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </Card>
    </Space>
  );
}

// ── 子面板组件 ──

function ProblemOverviewPanel({ problem }: { problem: AnalysisProblemDto }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions
        title="基本信息"
        bordered
        size="small"
        column={{ xs: 1, sm: 2, md: 3 }}
      >
        <Descriptions.Item label="编号">{problem.code}</Descriptions.Item>
        <Descriptions.Item label="类型">
          {TYPE_LABEL[problem.type]}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          {STATUS_LABEL[problem.status]}
        </Descriptions.Item>
        <Descriptions.Item label="所属项目">
          {problem.projectName}
        </Descriptions.Item>
        <Descriptions.Item label="负责人">
          {problem.owner} ({problem.ownerRole})
        </Descriptions.Item>
        <Descriptions.Item label="Baseline">
          <Text code>{problem.baselineId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(problem.createdAt).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(problem.updatedAt).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="运行次数">
          {problem.runCount}
        </Descriptions.Item>
      </Descriptions>

      <Card size="small" title="问题描述">
        <Paragraph>{problem.description}</Paragraph>
      </Card>

      <Card size="small" title="Baseline 与来源">
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Baseline ID">
            <Text code copyable>
              {problem.baselineId}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Baseline Hash">
            <Text code copyable>
              {problem.baselineHash}
            </Text>
          </Descriptions.Item>
        </Descriptions>
        <Alert
          type="info"
          showIcon
          message="Baseline 变化将使现有运行结果失效"
          description="分析期间源 Baseline 变化则旧结果过期；可保留比较但必须重算或人工确认。"
          style={{ marginTop: 12 }}
        />
      </Card>
    </Space>
  );
}

function InputPanel({
  problem,
  meshQuality,
}: {
  problem: AnalysisProblemDto;
  meshQuality: MeshQualityDto | null;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="输入条目（V0：使用占位结构展示，后端 API 待 V1 实现）"
        description="假设 / 边界条件 / 荷载工况 / 材料 / 网格 列表与编辑功能在 V1 阶段实现。当前仅展示数量统计。"
      />

      <Descriptions title="输入完整度" bordered size="small" column={2}>
        <Descriptions.Item label="假设条目">
          <Tag color="blue">{problem.assumptionCount}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="边界条件">
          <Tag color="blue">{problem.boundaryConditionCount}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="荷载工况">
          <Tag color="blue">{problem.loadCaseCount}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="输入完整度">
          <Progress
            percent={problem.inputCompleteness}
            size="small"
            status={
              problem.inputCompleteness >= 100
                ? "success"
                : problem.inputCompleteness >= 80
                  ? "active"
                  : "exception"
            }
            style={{ width: 200 }}
          />
        </Descriptions.Item>
      </Descriptions>

      {meshQuality && (
        <Card
          size="small"
          title={
            <Space>
              <ApartmentOutlined />
              <span>网格质量</span>
              <Tag color="geekblue">等级 {meshQuality.qualityGrade}</Tag>
            </Space>
          }
        >
          <Descriptions size="small" column={{ xs: 2, sm: 3, md: 4 }} bordered>
            <Descriptions.Item label="总单元数">
              {meshQuality.totalElements.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="总节点数">
              {meshQuality.totalNodes.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="最小雅可比">
              <span
                style={{
                  color: meshQuality.minJacobian < 0.2 ? "#ff4d4f" : "#52c41a",
                }}
              >
                {meshQuality.minJacobian.toFixed(3)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="最大长宽比">
              <span
                style={{
                  color:
                    meshQuality.maxAspectRatio > 10 ? "#ff4d4f" : "#52c41a",
                }}
              >
                {meshQuality.maxAspectRatio.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="失败单元数">
              <span
                style={{
                  color:
                    meshQuality.failedElements > 100 ? "#ff4d4f" : "#52c41a",
                }}
              >
                {meshQuality.failedElements}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="失败率">
              <span
                style={{
                  color: meshQuality.failureRate > 0.1 ? "#ff4d4f" : "#52c41a",
                }}
              >
                {meshQuality.failureRate.toFixed(4)}%
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Space>
  );
}

function ScenarioPanel({
  scenarios,
  solverProfiles,
}: {
  scenarios: AnalysisScenarioDto[];
  solverProfiles: SolverProfileDto[];
}) {
  const columns: ColumnsType<AnalysisScenarioDto> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            {record.isRecommended && (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                推荐
              </Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: "Solver",
      dataIndex: "solverProfileName",
      key: "solverProfileName",
      width: 200,
      render: (name: string) => <Text code>{name}</Text>,
    },
    {
      title: "网格密度",
      dataIndex: "meshDensity",
      key: "meshDensity",
      width: 110,
      render: (v: AnalysisScenarioDto["meshDensity"]) => {
        const color =
          v === "very_fine"
            ? "purple"
            : v === "fine"
              ? "blue"
              : v === "medium"
                ? "cyan"
                : "default";
        const label =
          v === "very_fine"
            ? "极细"
            : v === "fine"
              ? "细"
              : v === "medium"
                ? "中"
                : "粗";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "时间步长",
      dataIndex: "timeStep",
      key: "timeStep",
      width: 100,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: "收敛容差",
      dataIndex: "tolerance",
      key: "tolerance",
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: "最大迭代",
      dataIndex: "maxIterations",
      key: "maxIterations",
      width: 100,
      align: "center",
      render: (n: number) => <Tag>{n}</Tag>,
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
      <Alert
        type="info"
        showIcon
        message="场景列表已对接后端 API"
        description="场景数据来自 GET /api/v1/analysis/problems/{problemId}/scenarios，场景创建/编辑在 V1 阶段实现。"
      />
      {scenarios.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无场景，请先创建"
        />
      ) : (
        <>
          <Table<AnalysisScenarioDto>
            rowKey="id"
            columns={columns}
            dataSource={scenarios}
            size="small"
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions
                  size="small"
                  column={{ xs: 1, sm: 2, md: 3 }}
                  title="场景参数"
                >
                  {record.parameters.map((p) => (
                    <Descriptions.Item
                      key={p.key}
                      label={`${p.key} (${p.unit})`}
                    >
                      <Text strong>{p.value}</Text>
                    </Descriptions.Item>
                  ))}
                  <Descriptions.Item label="总时长">
                    {record.totalTime ?? "—"}
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </>
      )}

      <Card size="small" title="可用 Solver">
        {solverProfiles.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={solverProfiles}
            renderItem={(s) => (
              <List.Item>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space direction="vertical" size={0}>
                    <Space>
                      <Text strong>{s.name}</Text>
                      <Tag color="geekblue">v{s.version}</Tag>
                      <Tag>{s.solverType}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      许可证：{s.licenseType} · 估算时长{" "}
                      {s.estimatedDurationMin} min · 估算成本 ¥{s.estimatedCost}
                    </Text>
                  </Space>
                  <Tag color={s.available ? "success" : "error"}>
                    {s.available ? "可用" : "不可用"}
                  </Tag>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}

function RunMonitorPanel({
  runId,
  timeline,
  convergence,
  runStatus,
}: {
  runId: string | null;
  timeline: RunTimelineEventDto[];
  convergence: ConvergenceMetricDto[];
  runStatus: RunStatus | undefined;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message={`运行 ID: ${runId}`}
        description={
          runStatus ? `当前状态：${RUN_STATUS_LABEL[runStatus]}` : "未启动运行"
        }
      />

      {/* 运行时间线（对齐 D37.14 §可访问性：Step 时间线有列表） */}
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined />
            <span>运行时间线</span>
            <Tag color="blue">{timeline.length} 事件</Tag>
          </Space>
        }
      >
        {timeline.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />
        ) : (
          <Timeline
            items={timeline.map((e) => ({
              key: e.id,
              dot: TIMELINE_ICON_MAP[e.type],
              color:
                e.type === "failed" || e.type === "error"
                  ? "red"
                  : e.type === "warning" || e.type === "diverged"
                    ? "orange"
                    : e.type === "converged" || e.type === "completed"
                      ? "green"
                      : "blue",
              children: (
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Space>
                    <Text strong>{e.message}</Text>
                  </Space>
                  <Space size="middle">
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(e.timestamp).toLocaleString("zh-CN")}
                    </Text>
                    {typeof e.iteration === "number" && (
                      <Tag color="blue">iter {e.iteration}</Tag>
                    )}
                    {typeof e.residual === "number" && (
                      <Tag color="purple">
                        残差 {e.residual.toExponential(2)}
                      </Tag>
                    )}
                  </Space>
                  {e.detail && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {e.detail}
                    </Text>
                  )}
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      {/* 收敛指标（对齐 D37.14 §Residual/Balance charts） */}
      <Card
        size="small"
        title={
          <Space>
            <BarChartOutlined />
            <span>收敛指标</span>
          </Space>
        }
      >
        {convergence.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {convergence.map((c) => (
              <Card
                key={c.id}
                size="small"
                type="inner"
                title={
                  <Space>
                    <Text strong>{c.name}</Text>
                    <Tag color={c.converged ? "success" : "warning"}>
                      {c.converged ? "已收敛" : "未收敛"}
                    </Tag>
                    <Tag>{c.type}</Tag>
                  </Space>
                }
              >
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="当前值">
                    <span
                      style={{
                        color: c.converged ? "#52c41a" : "#faad14",
                        fontWeight: 600,
                      }}
                    >
                      {c.currentValue.toExponential(3)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="目标值">
                    {c.targetValue.toExponential(3)}
                  </Descriptions.Item>
                </Descriptions>

                {/* 残差历史条形图（V0：纯 CSS 简化展示） */}
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    收敛历史（log scale）
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 4,
                      height: 80,
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "#fafafa",
                      borderRadius: 4,
                    }}
                  >
                    {c.history.map((v, i) => {
                      const logV = Math.log10(Math.max(v, 1e-12));
                      const heightPercent = Math.max(
                        4,
                        Math.min(100, (logV + 6) * 16),
                      );
                      const isLast = i === c.history.length - 1;
                      return (
                        <Tooltip
                          key={i}
                          title={`迭代 ${i + 1}: ${v.toExponential(3)}`}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 8,
                              height: `${heightPercent}%`,
                              background: isLast
                                ? c.converged
                                  ? "#52c41a"
                                  : "#faad14"
                                : "#1890ff",
                              opacity: isLast ? 1 : 0.6,
                              borderRadius: 2,
                              transition: "all 200ms",
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 10,
                      color: "#999",
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      迭代 1
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      迭代 {c.history.length}
                    </Text>
                  </div>
                </div>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}

function ResultViewerPanel({ result }: { result: AnalysisResultDto | null }) {
  if (!result) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无结果，请先运行 Scenario"
      />
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 结果概要 */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space align="center" wrap>
            <Title level={5} style={{ margin: 0 }}>
              {result.name}
            </Title>
            <Tag color={QUALITY_COLOR[result.qualityStatus]}>
              {QUALITY_LABEL[result.qualityStatus]}
            </Tag>
            <Tag color="geekblue">{result.sizeMb.toFixed(1)} MB</Tag>
            {result.downloadUrl && (
              <Tooltip title="V0：下载 URL 占位">
                <Button size="small" icon={<CloudDownloadOutlined />} disabled>
                  下载原始证据
                </Button>
              </Tooltip>
            )}
          </Space>
          <Descriptions size="small" column={{ xs: 2, sm: 3, md: 4 }} bordered>
            <Descriptions.Item label="生成时间">
              {new Date(result.generatedAt).toLocaleString("zh-CN")}
            </Descriptions.Item>
            <Descriptions.Item label="时间步数">
              <Tag color="blue">{result.timeSteps}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="空间网格点数">
              <Tag color="blue">{result.spatialPoints.toLocaleString()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="包含变量">
              {result.variables.length}
            </Descriptions.Item>
            <Descriptions.Item label="包含 case">
              {result.cases.length}
            </Descriptions.Item>
            {result.supersededBy && (
              <Descriptions.Item label="已被取代">
                <Tag color="purple">由 {result.supersededBy} 取代</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Space>
      </Card>

      {/* 大结果分层加载提示（对齐 D37.14 §大结果） */}
      <Alert
        type="info"
        showIcon
        icon={<ApartmentOutlined />}
        message="大结果分层加载"
        description="结果按变量 / case / time / 空间分层加载；色标 / 单位 / 范围固定；可下载原始证据和表格摘要。V0 阶段仅展示指标摘要，结果可视化在 V1 实现。"
      />

      {/* 关键指标 */}
      <Card
        size="small"
        title={
          <Space>
            <BarChartOutlined />
            <span>关键指标摘要</span>
          </Space>
        }
      >
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          dataSource={result.metrics}
          columns={[
            {
              title: "指标",
              dataIndex: "name",
              key: "name",
              render: (name: string) => <Text strong>{name}</Text>,
            },
            {
              title: "值",
              dataIndex: "value",
              key: "value",
              render: (v: number, record) => (
                <Text code>
                  {typeof v === "number" ? v.toFixed(3) : v} {record.unit}
                </Text>
              ),
            },
            {
              title: "阈值",
              dataIndex: "threshold",
              key: "threshold",
              render: (t: number | undefined, record) =>
                typeof t === "number" ? (
                  <Text type="secondary">
                    ≤ {t} {record.unit}
                  </Text>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: "是否满足",
              dataIndex: "withinThreshold",
              key: "withinThreshold",
              width: 110,
              render: (within: boolean) =>
                within ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    满足
                  </Tag>
                ) : (
                  <Tag color="error" icon={<WarningOutlined />}>
                    超限
                  </Tag>
                ),
            },
          ]}
        />
      </Card>

      {/* Benchmark 对比 */}
      {result.benchmarkComparison && (
        <Card
          size="small"
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>Benchmark 对比</span>
            </Space>
          }
        >
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="基准名称">
              {result.benchmarkComparison.benchmarkName}
            </Descriptions.Item>
            <Descriptions.Item label="偏差">
              <span
                style={{
                  color: result.benchmarkComparison.passed
                    ? "#52c41a"
                    : "#faad14",
                  fontWeight: 600,
                }}
              >
                {result.benchmarkComparison.deviationPercent.toFixed(2)}%
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="是否通过">
              {result.benchmarkComparison.passed ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  通过
                </Tag>
              ) : (
                <Tag color="warning" icon={<WarningOutlined />}>
                  偏差超阈值
                </Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 变量与 case 列表（对齐 D37.14 §可访问性） */}
      <Card size="small" title="结果内容">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="变量列表">
              <Space wrap>
                {result.variables.map((v) => (
                  <Tag color="blue" key={v}>
                    {v}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Case 列表">
              <Space wrap>
                {result.cases.map((c) => (
                  <Tag color="purple" key={c}>
                    {c}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>
    </Space>
  );
}

function QualityRailPanel({
  assessment,
  result,
}: {
  assessment: ResultQualityAssessmentDto | null | undefined;
  result: AnalysisResultDto | null;
}) {
  if (!assessment || !result) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无质量评估，请先完成运行"
      />
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="复核界面不显示具有权威错觉的'AI 已批准'"
        description="AI/规则/分析只提供候选、Finding 或证据。接受率、置信分和综合评分不得单独决定发布，也不得隐藏反例、Unknown、Invalid 或适用域外结果。"
      />

      {/* 评估概要 */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space align="center" wrap>
            <Title level={5} style={{ margin: 0 }}>
              质量评估
            </Title>
            <Tag color={DECISION_COLOR[assessment.decision]}>
              {DECISION_LABEL[assessment.decision]}
            </Tag>
            <Tag color={QUALITY_COLOR[result.qualityStatus]}>
              结果：{QUALITY_LABEL[result.qualityStatus]}
            </Tag>
            {assessment.requiresExceptionApproval && (
              <Tag color="purple" icon={<SafetyCertificateOutlined />}>
                需例外批准
              </Tag>
            )}
          </Space>

          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
            <Descriptions.Item label="评估人">
              <Space size={4}>
                <Text>{assessment.reviewer}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ({assessment.reviewerRole})
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="评估时间">
              {new Date(assessment.assessedAt).toLocaleString("zh-CN")}
            </Descriptions.Item>
            <Descriptions.Item label="结果 ID">
              <Text code>{assessment.resultId}</Text>
            </Descriptions.Item>
            {assessment.requiresExceptionApproval && (
              <Descriptions.Item label="例外批准人">
                <Tag color="purple">{assessment.exceptionApprover ?? "—"}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>

          <Card size="small" type="inner" title="评估理由">
            <Paragraph>{assessment.reason}</Paragraph>
          </Card>
        </Space>
      </Card>

      {/* 检查清单（对齐 D37.14 §QualityChecklist） */}
      <Card
        size="small"
        title={
          <Space>
            <CheckCircleOutlined />
            <span>检查清单</span>
            <Tag color="blue">
              {assessment.checklist.filter((c) => c.passed).length} /{" "}
              {assessment.checklist.length}
            </Tag>
          </Space>
        }
      >
        <List
          size="small"
          dataSource={assessment.checklist}
          renderItem={(item) => (
            <List.Item>
              <Space
                style={{ width: "100%", justifyContent: "space-between" }}
                align="start"
              >
                <Space direction="vertical" size={0}>
                  <Space>
                    {item.passed ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <WarningOutlined style={{ color: "#faad14" }} />
                    )}
                    <Text strong={item.passed} delete={!item.passed}>
                      {item.label}
                    </Text>
                  </Space>
                  {item.remark && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.remark}
                    </Text>
                  )}
                </Space>
                <Tag color={item.passed ? "success" : "warning"}>
                  {item.passed ? "通过" : "未通过"}
                </Tag>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      {/* 决策类型说明 */}
      <Card size="small" title="决策类型说明">
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="ACCEPT_AS_DRAFT">
            接受为草稿，需后续修订
          </Descriptions.Item>
          <Descriptions.Item label="ACCEPT_AS_REVISION">
            接受为正式修订，可发布
          </Descriptions.Item>
          <Descriptions.Item label="REJECT">
            拒绝结果，需重运行
          </Descriptions.Item>
          <Descriptions.Item label="ESCALATE">
            上报审批，需上级介入
          </Descriptions.Item>
          <Descriptions.Item label="EXCEPTION">
            例外批准（需具备责主体签章）
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
