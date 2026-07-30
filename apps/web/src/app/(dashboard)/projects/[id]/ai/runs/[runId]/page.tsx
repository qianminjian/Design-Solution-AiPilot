"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type {
  AiInvocationRunDto,
  GuardrailDto,
  ToolCallDto,
} from "@design-platform/shared";
import {
  useAiRun,
  useAiSteps,
  useToolCalls,
  useGuardrails,
} from "@/hooks/use-ai-review";
import {
  AI_RISK_LEVEL_COLOR,
  AI_RISK_LEVEL_LABEL,
  AI_RUN_MODE_LABEL,
  AI_RUN_STATUS_COLOR,
  AI_RUN_STATUS_LABEL,
} from "@/hooks/use-ai-review";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { StepTimeline } from "../../../_components/ai-review/step-timeline";
import { ToolCallCard } from "../../../_components/ai-review/tool-call-card";
import { OutputDiffViewer } from "../../../_components/ai-review/output-diff";
import { GuardrailBanner } from "../../../_components/ai-review/guardrail-banner";
import { ReviewDecisionBar } from "../../../_components/ai-review/review-decision-bar";

const { Title, Text, Paragraph } = Typography;

/**
 * P09 AI/Agent 复核中心
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13
 *
 * 三栏布局：
 *   ┌──────────────┬──────────────────────────┬──────────────────┐
 *   │ Step 时间线  │ 输入/输出对照 + ToolCall │ Evidence rail    │
 *   │  - 步骤列表   │  - OutputDiff             │  - Citation      │
 *   │  - 状态监控   │  - ToolCallCard           │  - Confidence    │
 *   │              │  - GuardrailBanner        │  - Evaluation     │
 *   └──────────────┴──────────────────────────┴──────────────────┘
 *
 * 主动作（D37.13 §主动作）：
 *  - Accept as Draft / Edit / Reject / Escalate
 *  - 高风险输出只允许形成 Proposal/草稿
 *  - Accept 只生成带来源的 Draft/Revision Proposal，需字段级 diff + 目标 ETag + 责任确认
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有 AI 输出标记为"AI 辅助"
 *  - AI 不替代注册建筑师/工程师的专业审签和监管审批
 *  - 所有 AI 结果按风险等级进入人工复核流程
 *
 * V0：后端 AI Review API（D27/D28）尚未实现，前端通过 hook 空状态展示
 */

type CenterTab = "input" | "output" | "toolCalls" | "guardrails";

export default function AiRunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: projectId, runId } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<CenterTab>("input");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // ── 数据 hooks ──
  const runQuery = useAiRun(projectId, runId);
  const stepsQuery = useAiSteps(projectId, runId);
  const toolCallsQuery = useToolCalls(projectId, runId);
  const guardrailsQuery = useGuardrails(projectId, runId);

  const run = runQuery.data;
  const steps = useMemo(() => stepsQuery.data ?? [], [stepsQuery.data]);
  const toolCalls = useMemo(
    () => toolCallsQuery.data ?? [],
    [toolCallsQuery.data],
  );
  const guardrails = useMemo(
    () => guardrailsQuery.data ?? [],
    [guardrailsQuery.data],
  );

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  // 等待审批的 ToolCall
  const pendingApprovals = useMemo(
    () => toolCalls.filter((tc) => tc.status === "AWAITING_APPROVAL"),
    [toolCalls],
  );

  // ── 加载/错误状态 ──
  if (runQuery.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (runQuery.isError) {
    return (
      <DataErrorAlert
        error={runQuery.error}
        context="AI 运行详情"
        variant="result"
        onRetry={() => void runQuery.refetch()}
        retryLabel="重试"
      />
    );
  }

  if (!run) {
    return (
      <Empty
        description={
          <span style={{ fontSize: 12 }}>
            AI 运行不存在或已归档
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              后端 AI Review API（D27/D28）尚未实现，V0 阶段仅展示空状态
            </Text>
          </span>
        }
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          返回项目
        </Button>
      </Empty>
    );
  }

  // ── 派生数据 ──
  const requiresReview = run.requiresHumanReview && run.status === "COMPLETED";
  const isHighRisk = run.riskLevel === "HIGH" || run.riskLevel === "CRITICAL";

  // 顶部状态卡数据
  const blockedGuardrails = guardrails.filter((g) => g.status === "BLOCKED");
  const warningGuardrails = guardrails.filter((g) => g.status === "WARNING");

  return (
    <div style={{ padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>
      {/* 顶部 Run 头部 */}
      <RunHeader
        run={run}
        onBack={() => router.push(`/projects/${projectId}`)}
        onControl={(action) => {
          // V0 占位：控制运行
          void message(action);
        }}
      />

      {/* 等待审批提示 */}
      {pendingApprovals.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`${pendingApprovals.length} 个工具调用等待人工审批`}
          description={`Run 已暂停，请前往 "工具调用" Tab 审批后继续执行。`}
          style={{ marginTop: 12 }}
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => setActiveTab("toolCalls")}
            >
              前往审批
            </Button>
          }
        />
      )}

      {/* Guardrail 阻断提示 */}
      {blockedGuardrails.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`${blockedGuardrails.length} 个护栏阻断`}
          description={`护栏阻断：${blockedGuardrails
            .map((g) => g.name)
            .join("、")}`}
          style={{ marginTop: 12 }}
        />
      )}

      {/* Warning 护栏提示 */}
      {warningGuardrails.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${warningGuardrails.length} 个护栏警告`}
          description={`护栏警告：${warningGuardrails
            .map((g) => g.name)
            .join("、")}（允许通过但已记录）`}
          style={{ marginTop: 12 }}
        />
      )}

      {/* 三栏布局 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 360px",
          gap: 12,
          marginTop: 12,
          height: "calc(100vh - 280px)",
          minHeight: 600,
        }}
      >
        {/* 左栏：Step 时间线 */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e8e8e8",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <StepTimeline
            steps={steps}
            selectedStepId={selectedStepId}
            onSelect={setSelectedStepId}
            loading={stepsQuery.isLoading}
            error={stepsQuery.error}
          />
        </div>

        {/* 中栏：输入/输出/ToolCall/Guardrail */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e8e8e8",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Tab 切换 */}
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Segmented
              value={activeTab}
              onChange={(v) => setActiveTab(v as CenterTab)}
              options={[
                { label: "输入", value: "input" },
                { label: "输出 Diff", value: "output" },
                {
                  label: `工具调用 (${toolCalls.length})`,
                  value: "toolCalls",
                },
                {
                  label: `护栏 (${guardrails.length})`,
                  value: "guardrails",
                },
              ]}
            />
            {selectedStep && (
              <Tooltip title={`当前选中步骤 ${selectedStep.stepIndex}`}>
                <Tag color="blue">
                  Step {selectedStep.stepIndex}：{selectedStep.name}
                </Tag>
              </Tooltip>
            )}
          </div>

          {/* 中栏内容 */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {activeTab === "input" && <InputManifestView run={run} />}

            {activeTab === "output" && (
              <OutputDiffViewer diff={run.outputDiff ?? null} />
            )}

            {activeTab === "toolCalls" && (
              <ToolCallList
                toolCalls={toolCalls}
                loading={toolCallsQuery.isLoading}
                error={toolCallsQuery.error}
                selectedStepId={selectedStepId}
              />
            )}

            {activeTab === "guardrails" && (
              <GuardrailList
                guardrails={guardrails}
                loading={guardrailsQuery.isLoading}
                error={guardrailsQuery.error}
              />
            )}
          </div>
        </div>

        {/* 右栏：Evidence rail */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e8e8e8",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EvidenceRail run={run} />
        </div>
      </div>

      {/* 决策栏 */}
      {requiresReview && (
        <ReviewDecisionBar
          run={run}
          open={decisionOpen}
          onOpen={() => setDecisionOpen(true)}
          onClose={() => setDecisionOpen(false)}
        />
      )}

      {/* AI 安全声明 */}
      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="AI 辅助输出声明"
        description={
          <span style={{ fontSize: 12 }}>
            本 Run 输出标记为 <Tag color="blue">AI 辅助</Tag>，
            <Text strong>不替代注册建筑师/工程师的专业审签和监管审批</Text>。
            {isHighRisk
              ? "高风险输出只允许形成 Proposal/草稿，不直接进入业务状态。"
              : "请按风险等级进入人工复核流程。"}
          </span>
        }
        style={{ marginTop: 12 }}
      />
    </div>
  );
}

// ── 辅助组件 ──

/** 临时 message 占位（避免引入 antd App.useApp 全局上下文） */
function message(_text: string) {
  // V0 占位：实际控制运行 API 后用 message.success/error
}

/** Run 头部信息卡 */
function RunHeader({
  run,
  onBack,
  onControl,
}: {
  run: AiInvocationRunDto;
  onBack: () => void;
  onControl: (action: "PAUSE" | "RESUME" | "CANCEL") => void;
}) {
  const isRunning = run.status === "RUNNING";
  const isPaused = run.status === "PAUSED";

  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        border: "1px solid #e8e8e8",
      }}
    >
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} type="text" />
          <Title level={5} style={{ margin: 0 }}>
            <ExperimentOutlined /> {run.name}
          </Title>
          <Tag color={AI_RUN_STATUS_COLOR[run.status]}>
            {AI_RUN_STATUS_LABEL[run.status]}
          </Tag>
          <Tag>{AI_RUN_MODE_LABEL[run.mode]}</Tag>
          <Tag color={AI_RISK_LEVEL_COLOR[run.riskLevel]}>
            {AI_RISK_LEVEL_LABEL[run.riskLevel]}
          </Tag>
          {run.requiresHumanReview && <Tag color="processing">待人工复核</Tag>}
        </Space>
        <Space>
          {(isRunning || isPaused) && (
            <>
              {isRunning && (
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={() => onControl("PAUSE")}
                >
                  暂停
                </Button>
              )}
              {isPaused && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onControl("RESUME")}
                >
                  恢复
                </Button>
              )}
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => onControl("CANCEL")}
              >
                取消
              </Button>
            </>
          )}
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} type="text" />
          </Tooltip>
        </Space>
      </Space>

      <Paragraph
        type="secondary"
        style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
      >
        Run #{run.runIndex} · {run.purpose}
        {run.initiatedByName && ` · 发起人 ${run.initiatedByName}`}
        {run.latencyMs && ` · 耗时 ${(run.latencyMs / 1000).toFixed(2)}s`}
        {run.tokenUsage && (
          <>
            {" "}
            · Tokens {run.tokenUsage.totalTokens}
            {run.tokenUsage.estimatedCostUsd && (
              <Text type="secondary">
                {" "}
                · 预估成本 ${run.tokenUsage.estimatedCostUsd.toFixed(4)}
              </Text>
            )}
          </>
        )}
      </Paragraph>
    </div>
  );
}

/** 输入清单视图 */
function InputManifestView({ run }: { run: AiInvocationRunDto }) {
  const m = run.inputManifest;
  return (
    <div>
      <Title level={5}>输入清单</Title>
      <Descriptions
        size="small"
        column={1}
        bordered
        labelStyle={{ width: 180, fontSize: 12 }}
        contentStyle={{ fontSize: 12 }}
      >
        <Descriptions.Item label="Capability">
          <Tag color="blue">{m.capabilityName}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="模型">
          <Text code style={{ fontSize: 11 }}>
            {m.modelName}
          </Text>
          {m.modelReleaseId && (
            <Tag style={{ marginLeft: 8, fontSize: 10 }}>
              Release: {m.modelReleaseId}
            </Tag>
          )}
        </Descriptions.Item>
        {m.promptTemplateName && (
          <Descriptions.Item label="Prompt 模板">
            <Text code style={{ fontSize: 11 }}>
              {m.promptTemplateName}
            </Text>
            {m.promptTemplateVersion && (
              <Tag style={{ marginLeft: 8, fontSize: 10 }}>
                v{m.promptTemplateVersion}
              </Tag>
            )}
          </Descriptions.Item>
        )}
        {m.policyVersion && (
          <Descriptions.Item label="Policy 版本">
            <Text code style={{ fontSize: 11 }}>
              {m.policyVersion}
            </Text>
          </Descriptions.Item>
        )}
        {m.inputDataVersion && (
          <Descriptions.Item label="输入数据版本">
            <Text code style={{ fontSize: 11 }}>
              {m.inputDataVersion}
            </Text>
          </Descriptions.Item>
        )}
        {m.temperature !== undefined && m.temperature !== null && (
          <Descriptions.Item label="温度参数">
            {m.temperature}
          </Descriptions.Item>
        )}
        {m.maxTokens !== undefined && m.maxTokens !== null && (
          <Descriptions.Item label="最大 Token 数">
            {m.maxTokens}
          </Descriptions.Item>
        )}
      </Descriptions>

      {m.system && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 12 }}>
            系统指令
          </Text>
          <Paragraph
            style={{
              background: "#fafafa",
              padding: 8,
              borderRadius: 4,
              fontSize: 11,
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              margin: "4px 0 0",
            }}
          >
            {m.system}
          </Paragraph>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 12 }}>
          Prompt（脱敏后）
        </Text>
        <Paragraph
          style={{
            background: "#fafafa",
            padding: 8,
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            margin: "4px 0 0",
          }}
        >
          {m.prompt}
        </Paragraph>
      </div>

      {run.sourceRevisionId && (
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          style={{ marginTop: 16 }}
          message={
            <span style={{ fontSize: 12 }}>
              源版本固定：
              <Text code style={{ fontSize: 11, marginLeft: 4 }}>
                {run.sourceRevisionId}
              </Text>
            </span>
          }
          description="输入版本已固定，Run 期间源数据变化不影响本次执行"
        />
      )}
    </div>
  );
}

/** 工具调用列表 */
function ToolCallList({
  toolCalls,
  loading,
  error,
  selectedStepId,
}: {
  toolCalls: ToolCallDto[];
  loading: boolean;
  error: unknown;
  selectedStepId: string | null;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <DataErrorAlert error={error} context="工具调用列表" />;
  }

  if (toolCalls.length === 0) {
    return (
      <Empty
        description={
          <span style={{ fontSize: 12 }}>
            暂无工具调用
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              本 Run 未触发任何工具调用（如纯 LLM 对话）
            </Text>
          </span>
        }
      />
    );
  }

  // 按步骤过滤
  const filtered = selectedStepId
    ? toolCalls.filter((tc) => tc.stepId === selectedStepId)
    : toolCalls;

  if (filtered.length === 0) {
    return (
      <Empty
        description={<span style={{ fontSize: 12 }}>当前步骤无工具调用</span>}
      />
    );
  }

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {filtered.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </Space>
  );
}

/** 护栏列表 */
function GuardrailList({
  guardrails,
  loading,
  error,
}: {
  guardrails: GuardrailDto[];
  loading: boolean;
  error: unknown;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <DataErrorAlert error={error} context="护栏列表" />;
  }

  if (guardrails.length === 0) {
    return (
      <Empty
        description={
          <span style={{ fontSize: 12 }}>
            暂无护栏记录
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              本 Run 未触发输入/输出护栏检查
            </Text>
          </span>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {guardrails.map((g) => (
        <GuardrailBanner key={g.id} guardrail={g} />
      ))}
    </Space>
  );
}

/** Evidence Rail（右栏） */
function EvidenceRail({ run }: { run: AiInvocationRunDto }) {
  const citations = run.citations ?? [];
  const confidence = run.confidence ?? null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          <ThunderboltOutlined /> Evidence Rail
        </Text>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {/* Citation 区段 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12 }}>
            引用证据（{citations.length}）
          </Text>
          {citations.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ fontSize: 11 }}>无引用</span>}
              style={{ marginTop: 16 }}
            />
          ) : (
            <Space
              direction="vertical"
              size={6}
              style={{ width: "100%", marginTop: 8 }}
            >
              {citations.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 8,
                    background: "#fafafa",
                    borderRadius: 4,
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <Text strong style={{ fontSize: 12 }}>
                      {c.title}
                    </Text>
                    <Tag style={{ fontSize: 10 }}>{c.type}</Tag>
                  </div>
                  <Text code style={{ fontSize: 10 }}>
                    {c.locator}
                  </Text>
                  {c.snippet && (
                    <Paragraph
                      style={{
                        fontSize: 11,
                        margin: "4px 0 0",
                        color: "#666",
                      }}
                    >
                      {c.snippet}
                    </Paragraph>
                  )}
                  {c.relevanceScore !== undefined &&
                    c.relevanceScore !== null && (
                      <Tag color="blue" style={{ fontSize: 10, marginTop: 4 }}>
                        相关性 {(c.relevanceScore * 100).toFixed(0)}%
                      </Tag>
                    )}
                </div>
              ))}
            </Space>
          )}
        </div>

        {/* Confidence 区段 */}
        {confidence && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 12 }}>
              置信度
            </Text>
            <div
              style={{
                padding: 8,
                background: "#fafafa",
                borderRadius: 4,
                marginTop: 4,
              }}
            >
              <Tag color="blue" style={{ fontSize: 12 }}>
                {(confidence.score * 100).toFixed(1)}%
              </Tag>
              {confidence.uncertainty && (
                <Paragraph
                  style={{ fontSize: 11, margin: "4px 0 0", color: "#666" }}
                >
                  <ExclamationCircleOutlined /> {confidence.uncertainty}
                </Paragraph>
              )}
              {confidence.basis && (
                <Paragraph
                  style={{ fontSize: 10, margin: "4px 0 0", color: "#999" }}
                >
                  依据：{confidence.basis}
                </Paragraph>
              )}
              {confidence.calibrationSource && (
                <Paragraph
                  style={{ fontSize: 10, margin: "4px 0 0", color: "#999" }}
                >
                  校准：{confidence.calibrationSource}
                </Paragraph>
              )}
            </div>
          </div>
        )}

        {/* 责任确认区段 */}
        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message={<span style={{ fontSize: 12 }}>人工责任确认</span>}
          description={
            <span style={{ fontSize: 11 }}>
              AI 输出不替代注册建筑师/工程师的专业审签。
              {run.requiresHumanReview && "本 Run 须进入人工复核流程。"}
            </span>
          }
          style={{ marginTop: 8 }}
        />
      </div>
    </div>
  );
}
