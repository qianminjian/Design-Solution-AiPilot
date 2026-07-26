"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Progress,
  Statistic,
  Row,
  Col,
  Modal,
  Input,
  Spin,
  Result,
  App,
  Steps,
  Collapse,
  Divider,
} from "antd";
// 注意：Result 仍保留用于"暂无门禁决策"的 info 状态展示，错误态改用 DataErrorAlert
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  GatewayOutlined,
  RightOutlined,
} from "@ant-design/icons";
import type {
  StageInstanceDto,
  StageStatus,
  GateDecision,
  GateStatus,
  DecideGateRequest,
} from "@design-platform/shared";
import { useProjectDetail } from "@/hooks/use-project-detail";
import { useGates, useDecideGate } from "@/hooks/use-gates";
import { useComplianceCheck } from "@/hooks/use-review";
import { GateDecisionForm } from "@/components/project/gate-decision-form";
import { ComplianceSummary } from "@/components/project/compliance-summary";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;

const STAGE_NAME_MAP: Record<string, string> = {
  "STG-P0": "前期策划",
  "STG-P1": "概念设计",
  "STG-P2": "方案设计",
  "STG-P3": "扩初设计",
  "STG-P4": "施工图设计",
  "STG-P5": "综合校审",
  "STG-P6": "发布交付",
  "STG-P7": "反馈变更",
  "STG-P8": "项目关闭",
};

const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  planned: "Planned",
  active: "Active",
  review_preparing: "Review Preparing",
  under_review: "Under Review",
  conditionally_approved: "Conditionally Approved",
  approved: "Approved",
  suspended: "Suspended",
  cancelled: "Cancelled",
  closed: "Closed",
};

const STAGE_STATUS_COLOR: Record<StageStatus, string> = {
  planned: "default",
  active: "processing",
  review_preparing: "processing",
  under_review: "processing",
  conditionally_approved: "success",
  approved: "success",
  suspended: "warning",
  cancelled: "error",
  closed: "success",
};

const GATE_DECISION_LABEL: Record<GateDecision, string> = {
  approved: "Approved",
  conditionally_approved: "Conditionally Approved",
  rework_required: "Rework Required",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

const GATE_DECISION_COLOR: Record<GateDecision, string> = {
  approved: "green",
  conditionally_approved: "blue",
  rework_required: "orange",
  suspended: "default",
  cancelled: "red",
};

const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  pending: "Pending",
  decided: "Decided",
  cancelled: "Cancelled",
};

/** Steps 组件对应的阶段状态映射 */
function getStepStatus(
  status: StageStatus,
): "wait" | "process" | "finish" | "error" {
  if (status === "approved" || status === "closed") return "finish";
  if (status === "cancelled" || status === "suspended") return "error";
  if (
    status === "active" ||
    status === "under_review" ||
    status === "review_preparing" ||
    status === "conditionally_approved"
  )
    return "process";
  return "wait";
}

export default function StageGatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();

  const { data, isLoading, isError, error } = useProjectDetail(projectId);

  const currentStage: StageInstanceDto | undefined = data?.stages.find(
    (s) => s.status !== "closed" && s.status !== "cancelled",
  );

  const { data: gates, isLoading: gatesLoading } = useGates(
    currentStage?.id ?? null,
  );

  // 合规检查数据
  const { data: complianceCheck } = useComplianceCheck(projectId);

  const decideGate = useDecideGate();

  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionComment, setTransitionComment] = useState("");
  const [transitionLoading, setTransitionLoading] = useState(false);

  // 当前展开的门禁决策表单
  const [activeGateId, setActiveGateId] = useState<string | null>(null);

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

  // 错误态：使用 DataErrorAlert 统一展示，替代 message.error() toast 与 Result 内联组合
  // 404/403/500/schema 校验失败均通过该组件处理
  if (isError || !data) {
    return (
      <DataErrorAlert
        error={error}
        context="阶段门项目"
        variant="result"
        onRetry={() => router.push("/projects")}
        retryLabel="返回项目列表"
      />
    );
  }

  const { project, stages } = data;

  const completedStages = stages.filter(
    (s) => s.status === "approved" || s.status === "closed",
  ).length;
  const totalStages = stages.length;
  const progress =
    totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const approvedGates =
    gates?.filter((g) => g.decision === "approved").length ?? 0;
  const pendingGates = gates?.filter((g) => g.status === "pending").length ?? 0;
  const rejectedGates =
    gates?.filter((g) => g.decision === "rework_required").length ?? 0;

  const handleTransition = async () => {
    if (!currentStage) return;

    setTransitionLoading(true);
    try {
      message.info("阶段流转功能建设中");
      setTransitionModalOpen(false);
      setTransitionComment("");
    } catch (err) {
      const tip = err instanceof Error ? err.message : "阶段流转失败";
      message.error(tip);
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleGateDecision = async (
    gateId: string,
    payload: DecideGateRequest,
  ) => {
    await decideGate.mutateAsync({ gateId, payload });
    setActiveGateId(null);
  };

  const canTransition =
    currentStage &&
    (currentStage.status === "approved" ||
      currentStage.status === "conditionally_approved");

  // 构建合规检查汇总数据
  const complianceSummaryData = complianceCheck
    ? {
        totalRules: complianceCheck.totalRules,
        passedRules: complianceCheck.passedRules,
        failedRules: complianceCheck.failedRules,
        checkStatus: complianceCheck.status,
      }
    : null;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
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
          onClick={() => router.push("/projects")}
          style={{ paddingLeft: 0 }}
        >
          返回项目列表
        </Button>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Stage Gate
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {project.name} · {project.code}
          </Text>
        </div>
        {canTransition && (
          <Button
            type="primary"
            icon={<RightOutlined />}
            onClick={() => setTransitionModalOpen(true)}
          >
            进入下一阶段
          </Button>
        )}
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Overall Progress"
              value={progress}
              suffix="%"
              valueStyle={{ color: "#2563eb" }}
            />
            <Progress
              percent={progress}
              strokeColor="#2563eb"
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Approved Gates"
              value={approvedGates}
              prefix={<CheckCircleOutlined style={{ color: "#16a34a" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pending Items"
              value={pendingGates}
              prefix={<ClockCircleOutlined style={{ color: "#d97706" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 阶段 Steps 进度条 */}
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <GatewayOutlined style={{ color: "#2563eb" }} />
          <Title level={5} style={{ margin: 0, color: "#2563eb" }}>
            Stage Progress
          </Title>
        </div>
        <Steps
          current={stages.findIndex((s) => s.id === currentStage?.id)}
          items={stages.map((stage) => ({
            title: STAGE_NAME_MAP[stage.stageCode] || stage.stageName,
            status: getStepStatus(stage.status),
            description: (
              <Tag
                color={STAGE_STATUS_COLOR[stage.status]}
                style={{ fontSize: 10 }}
              >
                {STAGE_STATUS_LABEL[stage.status]}
              </Tag>
            ),
          }))}
        />
      </Card>

      {/* 当前阶段详情 */}
      {currentStage && (
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <AlertOutlined style={{ color: "#2563eb" }} />
            <Title level={5} style={{ margin: 0, color: "#2563eb" }}>
              Current Stage:{" "}
              {STAGE_NAME_MAP[currentStage.stageCode] || currentStage.stageName}
            </Title>
            <Tag color={STAGE_STATUS_COLOR[currentStage.status]}>
              {STAGE_STATUS_LABEL[currentStage.status]}
            </Tag>
          </div>

          <Paragraph style={{ marginBottom: 20 }}>
            当前阶段门禁决策汇总，显示该阶段所有门禁的审批状态、通过率和待处理项。
          </Paragraph>

          <Row gutter={16}>
            <Col span={8}>
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: 16,
                  backgroundColor: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Approval Rate
                </Text>
                <div
                  style={{ fontSize: 32, fontWeight: 700, color: "#2563eb" }}
                >
                  {(gates?.length ?? 0) > 0
                    ? Math.round((approvedGates / (gates?.length ?? 0)) * 100)
                    : 0}
                  %
                </div>
                <Progress
                  percent={
                    (gates?.length ?? 0) > 0
                      ? Math.round((approvedGates / (gates?.length ?? 0)) * 100)
                      : 0
                  }
                  strokeColor="#2563eb"
                  size="small"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: 16,
                  backgroundColor: "#fef3c7",
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Pending Items
                </Text>
                <div
                  style={{ fontSize: 32, fontWeight: 700, color: "#d97706" }}
                >
                  {pendingGates}
                </div>
                <Text style={{ fontSize: 12, color: "#92400e" }}>
                  需要审批或处理的门禁项
                </Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: 16,
                  backgroundColor: "#fee2e2",
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Rejected Items
                </Text>
                <div
                  style={{ fontSize: 32, fontWeight: 700, color: "#dc2626" }}
                >
                  {rejectedGates}
                </div>
                <Text style={{ fontSize: 12, color: "#991b1b" }}>
                  需要返工的门禁项
                </Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 合规检查汇总 */}
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <CheckCircleOutlined style={{ color: "#2563eb" }} />
          <Title level={5} style={{ margin: 0 }}>
            Compliance Check Summary
          </Title>
        </div>
        <ComplianceSummary data={complianceSummaryData} loading={false} />
      </Card>

      {/* 门禁决策列表（带决策表单） */}
      <Card>
        <Title level={5} style={{ margin: 0, marginBottom: 16 }}>
          Gate Decisions
        </Title>

        {gatesLoading ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spin />
          </div>
        ) : (gates?.length ?? 0) === 0 ? (
          <Result
            status="info"
            title="暂无门禁决策"
            subTitle="当前阶段暂无门禁审批记录"
          />
        ) : (
          <Collapse
            accordion
            activeKey={activeGateId ?? undefined}
            onChange={(key) =>
              setActiveGateId(typeof key === "string" ? key : null)
            }
            items={(gates ?? []).map((gate) => ({
              key: gate.id,
              label: (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    paddingRight: 8,
                  }}
                >
                  <div>
                    <Text strong>{gate.gateName}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {gate.gateCode}
                    </Text>
                  </div>
                  <Tag
                    color={
                      gate.decision
                        ? GATE_DECISION_COLOR[gate.decision]
                        : "default"
                    }
                  >
                    {gate.decision
                      ? GATE_DECISION_LABEL[gate.decision]
                      : GATE_STATUS_LABEL[gate.status]}
                  </Tag>
                </div>
              ),
              children: (
                <div>
                  {/* 已有决策信息 */}
                  {gate.decision && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 24,
                          fontSize: 12,
                          color: "#64748b",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>状态: {GATE_STATUS_LABEL[gate.status]}</span>
                        {gate.decidedBy && (
                          <span>审批人: {gate.decidedBy}</span>
                        )}
                        {gate.decidedAt && (
                          <span>
                            审批时间:{" "}
                            {new Date(gate.decidedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {gate.comment && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 12,
                            backgroundColor: "#f8fafc",
                            borderRadius: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            审批意见
                          </Text>
                          <Text>{gate.comment}</Text>
                        </div>
                      )}
                      <Divider style={{ margin: "12px 0" }} />
                    </div>
                  )}

                  {/* 门禁决策表单（仅 pending 状态可用） */}
                  {gate.status === "pending" && (
                    <GateDecisionForm
                      gateId={gate.id}
                      gateName={gate.gateName}
                      gateStatus={gate.status}
                      onSubmit={handleGateDecision}
                      submitting={decideGate.isPending}
                      onCancel={() => setActiveGateId(null)}
                    />
                  )}

                  {gate.status === "decided" && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px 0",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      该门禁已完成决策
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Card>

      {/* 阶段流转弹窗 */}
      <Modal
        title="进入下一阶段"
        open={transitionModalOpen}
        onCancel={() => setTransitionModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setTransitionModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={transitionLoading}
            onClick={handleTransition}
          >
            确认流转
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Paragraph>
            当前阶段：{STAGE_NAME_MAP[currentStage?.stageCode ?? ""]}
          </Paragraph>
          <Paragraph>
            确认要将项目流转到下一阶段吗？此操作将触发门禁决策审核流程。
          </Paragraph>
          <Input.TextArea
            placeholder="请输入流转备注（可选）"
            value={transitionComment}
            onChange={(e) => setTransitionComment(e.target.value)}
            rows={3}
            style={{ resize: "none" }}
          />
        </Space>
      </Modal>
    </Space>
  );
}
