"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxOptionType,
  Descriptions,
  Empty,
  Input,
  List,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
  App,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  PUBLICATION_STATUS_COLOR,
  PUBLICATION_STATUS_LABEL,
  READINESS_CHECK_STATUS_COLOR,
  READINESS_CHECK_STATUS_LABEL,
  REVIEWER_DECISION_COLOR,
  REVIEWER_DECISION_LABEL,
  EVIDENCE_OUTCOME_COLOR,
  EVIDENCE_OUTCOME_LABEL,
  EVIDENCE_TYPE_LABEL,
  SIGNATURE_ROLE_LABEL,
  type EvidenceItemDto,
  type PublicationDetailDto,
  type ReadinessCheckDto,
  type ReadinessCheckStatus,
  type ReviewerDecisionDto,
  type ReviewerDecisionValue,
  type SignatureRole,
} from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import {
  useAcknowledgeWarnings,
  useBaselines,
  useCreatePublication,
  usePublicationChecks,
  usePublicationDetail,
  usePublicationEvidence,
  usePublicationReviewers,
  useSubmitPublication,
} from "@/hooks/use-publications";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * P11 发布向导 — 新建发布页（D37.15）
 *
 * 路由：/publications/new?baseline=
 *
 * 7 步流程（对齐 D37.15 §流程）：
 *  1 Select exact submission/baseline
 *  2 Completeness & dependency checks
 *  3 Version diff / issues / rules / AI-analysis evidence
 *  4 Discipline reviews & separation of duties
 *  5 Publication manifest / recipients / retention
 *  6 Step-up confirmation & submit Operation
 *  7 Receipt / signatures / immutable evidence
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 Publication API 未实现时显示空状态，不伪造数据
 *  - Step 1 调用 useBaselines 拉取真实 Baseline 列表
 *  - Step 2-3 调用 usePublicationChecks/usePublicationEvidence 拉取真实数据
 *  - Step 4 调用 usePublicationReviewers 拉取真实复核决策
 *  - Step 6 调用 useSubmitPublication mutation 触发真实提交
 *  - 主动作按钮在 API 404/501 时仍可点击但会显示错误（V0 不阻塞流程演示）
 *
 * 关键约束（对齐 D37.15）：
 *  - 最终提交只在所有阻断项关闭、精确 Baseline 冻结且 SoD 满足时启用
 *  - 每一步保存草稿；返回可恢复
 *  - 阻断/警告分离；所有 warning 需确认处置，不默认勾选
 *  - 发布后不可关闭对话框当作完成；显示 sealing/signing/object lock/notification 各 phase
 */

type StepKey =
  | "baseline"
  | "completeness"
  | "evidence"
  | "reviews"
  | "manifest"
  | "submit"
  | "receipt";

interface StepDef {
  key: StepKey;
  title: string;
  description: string;
}

const STEPS: StepDef[] = [
  {
    key: "baseline",
    title: "选择 Baseline",
    description: "确认精确的提交/Baseline",
  },
  {
    key: "completeness",
    title: "完整性检查",
    description: "依赖与成果完整度",
  },
  {
    key: "evidence",
    title: "证据审查",
    description: "版本差异 / Issue / 规则 / AI 分析",
  },
  {
    key: "reviews",
    title: "专业复核",
    description: "多专业评审与职责分离",
  },
  {
    key: "manifest",
    title: "发布清单",
    description: "收件人 / 留存期 / 签名要求",
  },
  {
    key: "submit",
    title: "二次确认",
    description: "Step-up 确认后提交",
  },
  {
    key: "receipt",
    title: "完成回执",
    description: "签名 / 不可变证据",
  },
];

export default function NewPublicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baselineParam = searchParams.get("baseline");
  const { message } = App.useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const currentStepDef = STEPS[currentStep]!;
  const [selectedBaseline, setSelectedBaseline] = useState<string>(
    baselineParam ?? "",
  );
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [warningAcknowledged, setWarningAcknowledged] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [retentionDays, setRetentionDays] = useState(3650);
  const [requiredSignatures, setRequiredSignatures] = useState<SignatureRole[]>(
    ["ARCHITECT", "STRUCTURAL_ENGINEER", "PROJECT_MANAGER"],
  );
  const [stepUpReason, setStepUpReason] = useState("");
  const [stepUpToken, setStepUpToken] = useState("");
  const [responsibilityAcknowledged, setResponsibilityAcknowledged] =
    useState(false);

  // 数据 hooks
  const baselinesQuery = useBaselines("current"); // V0：项目 ID 暂用 "current"
  const detailQuery = usePublicationDetail(publicationId);
  const checksQuery = usePublicationChecks(publicationId);
  const evidenceQuery = usePublicationEvidence(publicationId);
  const reviewersQuery = usePublicationReviewers(publicationId);

  const createMutation = useCreatePublication();
  const acknowledgeMutation = useAcknowledgeWarnings();
  const submitMutation = useSubmitPublication();

  const checks = checksQuery.data ?? [];
  const evidence = evidenceQuery.data ?? [];
  const reviewers = reviewersQuery.data ?? [];
  const detail = detailQuery.data;

  // 派生数据
  const blockingCount = checks.filter((c) => c.status === "BLOCKING").length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;
  const pendingReviewerCount = reviewers.filter(
    (r) => r.decision === "PENDING",
  ).length;
  const rejectReviewerCount = reviewers.filter(
    (r) => r.decision === "REJECT",
  ).length;

  // 判断是否可进入下一步（对齐 D37.15 §正常状态）
  const canGoNext = (() => {
    switch (currentStepDef.key) {
      case "baseline":
        return (
          selectedBaseline.length > 0 && publicationTitle.trim().length > 0
        );
      case "completeness":
        return blockingCount === 0;
      case "evidence":
        // 所有 warning 必须被确认处置
        return checks
          .filter((c) => c.status === "WARNING" && c.requiresAcknowledgment)
          .every((c) => warningAcknowledged.includes(c.id));
      case "reviews":
        // 所有评审必须有决策（不能 PENDING），且不能有 REJECT
        return pendingReviewerCount === 0 && rejectReviewerCount === 0;
      case "manifest":
        return (
          publicationTitle.trim().length > 0 &&
          recipients.length > 0 &&
          retentionDays > 0 &&
          requiredSignatures.length > 0
        );
      case "submit":
        // Step-up 必须填写原因 + Token + 责任确认
        return (
          stepUpReason.trim().length >= 10 &&
          stepUpToken.length > 0 &&
          responsibilityAcknowledged
        );
      case "receipt":
        return submitMutation.isSuccess;
      default:
        return false;
    }
  })();

  const handleNext = async () => {
    if (!canGoNext) {
      message.warning("当前步骤存在未解决的阻断项，无法进入下一步");
      return;
    }

    // Step 1 → Step 2：首次创建 Publication（V0：尝试调用 API，失败则保持本地状态）
    if (currentStepDef.key === "baseline" && !publicationId) {
      try {
        const result = await createMutation.mutateAsync({
          projectId: "current",
          title: publicationTitle,
          baselineId: selectedBaseline,
          manifest: {
            retentionDays,
            requiredSignatures,
            generateArchivePackage: true,
            enableObjectLock: true,
          },
          acknowledgedWarningIds: [],
          stepUpReason: "",
        });
        setPublicationId(result.id);
        message.success("已创建发布草稿");
      } catch {
        // V0：后端未实现时仍允许进入下一步（仅本地状态）
        message.info(
          "V0：后端 Publication API 未实现，使用本地状态继续演示流程",
        );
      }
    }

    // Step 3 → Step 4：提交警告项确认
    if (
      currentStepDef.key === "evidence" &&
      warningAcknowledged.length > 0 &&
      publicationId
    ) {
      try {
        await acknowledgeMutation.mutateAsync({
          publicationId,
          checkIds: warningAcknowledged,
        });
      } catch {
        // V0：后端未实现时静默失败
      }
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!publicationId) {
      message.warning("V0：后端未创建发布草稿，无法提交");
      return;
    }
    try {
      await submitMutation.mutateAsync({
        publicationId,
        stepUpReason,
        stepUpToken,
        responsibilityAcknowledged,
      });
      message.success("发布请求已提交");
    } catch {
      message.error("提交失败：后端 API 可能未实现（V0 预期）");
    }
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
          onClick={() => router.push("/publications")}
          style={{ paddingLeft: 0 }}
        >
          返回发布列表
        </Button>
      </div>

      {/* 页面标题 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <CloudUploadOutlined style={{ marginRight: 8 }} />
            新建发布
          </Title>
          <Text type="secondary">
            Publication Wizard（D37.15 P11）· 7 步流程 · V0
            阶段：后端未实现时显示空状态
          </Text>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="发布 API 待 V1 实现"
        description="后端 Publication / Signature / Recipient API 尚未实现。下方向导可填写表单字段，提交操作尝试调用 API；返回 404/501 时显示提示。"
      />

      {/* 阻断/警告汇总条（对齐 D37.15 §Readiness/Blocking rail） */}
      <Card size="small" bodyStyle={{ padding: "8px 12px" }}>
        <Space size="large" wrap>
          <Space size={4}>
            <Tag color={blockingCount === 0 ? "success" : "error"}>
              阻断: {blockingCount}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {blockingCount === 0 ? "已全部解决" : "需先关闭阻断项"}
            </Text>
          </Space>
          <Space size={4}>
            <Tag color={warningCount === 0 ? "success" : "warning"}>
              警告: {warningCount}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {warningCount === 0
                ? "无警告"
                : `已确认 ${warningAcknowledged.length} / ${warningCount}`}
            </Text>
          </Space>
          <Space size={4}>
            <Tag color={pendingReviewerCount === 0 ? "success" : "processing"}>
              待评审: {pendingReviewerCount}
            </Tag>
          </Space>
          {rejectReviewerCount > 0 && (
            <Space size={4}>
              <Tag color="error">拒绝: {rejectReviewerCount}</Tag>
            </Space>
          )}
        </Space>
      </Card>

      {/* Stepper */}
      <Card size="small">
        <Steps
          current={currentStep}
          onChange={(target) => {
            if (target <= currentStep) {
              setCurrentStep(target);
            } else if (target === currentStep + 1 && canGoNext) {
              setCurrentStep(target);
            } else {
              message.warning("请先完成当前步骤");
            }
          }}
          items={STEPS.map((step) => ({
            title: step.title,
            description: step.description,
          }))}
        />
      </Card>

      {/* 当前步骤主区 */}
      <Card size="small">
        {currentStepDef.key === "baseline" && (
          <BaselineStep
            selectedBaseline={selectedBaseline}
            onSelectBaseline={setSelectedBaseline}
            publicationTitle={publicationTitle}
            onTitleChange={setPublicationTitle}
            baselines={baselinesQuery.data ?? []}
            loading={baselinesQuery.isLoading}
            error={baselinesQuery.error}
          />
        )}

        {currentStepDef.key === "completeness" && (
          <CompletenessStep
            checks={checks}
            loading={checksQuery.isLoading}
            error={checksQuery.error}
          />
        )}

        {currentStepDef.key === "evidence" && (
          <EvidenceStep
            evidence={evidence}
            checks={checks.filter((c) => c.status === "WARNING")}
            acknowledged={warningAcknowledged}
            onAcknowledgeChange={setWarningAcknowledged}
            loading={evidenceQuery.isLoading || checksQuery.isLoading}
            error={evidenceQuery.error ?? checksQuery.error}
          />
        )}

        {currentStepDef.key === "reviews" && (
          <ReviewsStep
            reviewers={reviewers}
            loading={reviewersQuery.isLoading}
            error={reviewersQuery.error}
          />
        )}

        {currentStepDef.key === "manifest" && (
          <ManifestStep
            recipients={recipients}
            onRecipientsChange={setRecipients}
            retentionDays={retentionDays}
            onRetentionDaysChange={setRetentionDays}
            requiredSignatures={requiredSignatures}
            onRequiredSignaturesChange={setRequiredSignatures}
          />
        )}

        {currentStepDef.key === "submit" && (
          <SubmitStep
            title={publicationTitle}
            baseline={selectedBaseline}
            stepUpReason={stepUpReason}
            onStepUpReasonChange={setStepUpReason}
            stepUpToken={stepUpToken}
            onStepUpTokenChange={setStepUpToken}
            responsibilityAcknowledged={responsibilityAcknowledged}
            onResponsibilityAcknowledgedChange={setResponsibilityAcknowledged}
            blockingCount={blockingCount}
            warningCount={warningCount}
            pendingReviewerCount={pendingReviewerCount}
          />
        )}

        {currentStepDef.key === "receipt" && (
          <ReceiptStep
            submitted={submitMutation.isSuccess}
            detail={detail ?? null}
            title={publicationTitle}
            baseline={selectedBaseline}
          />
        )}
      </Card>

      {/* 底部导航（对齐 D37.15 §底部 Back/Save/Next/Submit） */}
      <Card size="small" bodyStyle={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            上一步
          </Button>
          <Space>
            <Tooltip
              title={
                !canGoNext
                  ? "当前步骤存在未解决的阻断项或必填项"
                  : "保存草稿并进入下一步"
              }
            >
              <Button
                type={currentStepDef.key === "submit" ? "default" : "primary"}
                disabled={!canGoNext || submitMutation.isPending}
                onClick={() => {
                  if (currentStepDef.key === "submit") {
                    void handleSubmit();
                  } else {
                    void handleNext();
                  }
                }}
                icon={
                  currentStepDef.key === "submit" ? (
                    <SendOutlined />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                loading={
                  submitMutation.isPending ||
                  createMutation.isPending ||
                  acknowledgeMutation.isPending
                }
              >
                {currentStepDef.key === "submit"
                  ? submitMutation.isSuccess
                    ? "已提交"
                    : "提交发布"
                  : "保存并下一步"}
              </Button>
            </Tooltip>
            {currentStepDef.key === "receipt" &&
              submitMutation.isSuccess &&
              detail && (
                <Button
                  type="primary"
                  onClick={() => router.push(`/publications/${detail.id}`)}
                >
                  查看发布详情
                </Button>
              )}
          </Space>
        </div>
      </Card>
    </Space>
  );
}

// ── Step 1: Baseline 选择 ──

function BaselineStep({
  selectedBaseline,
  onSelectBaseline,
  publicationTitle,
  onTitleChange,
  baselines,
  loading,
  error,
}: {
  selectedBaseline: string;
  onSelectBaseline: (val: string) => void;
  publicationTitle: string;
  onTitleChange: (val: string) => void;
  baselines: { id: string; title: string; hash: string; frozenAt: string }[];
  loading: boolean;
  error: unknown;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>选择精确的提交 / Baseline</Title>
      <Paragraph type="secondary">
        发布须基于冻结的 Baseline。一旦发布，Baseline
        不可修改，所有签章与证据将绑定到此版本。
      </Paragraph>

      {error ? (
        <DataErrorAlert
          error={error}
          context="Baseline 列表"
          variant="inline"
        />
      ) : null}

      <Spin spinning={loading}>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="发布标题">
            <Input
              value={publicationTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="如：V2 方案设计交付 - 全专业"
              maxLength={256}
            />
          </Descriptions.Item>
          <Descriptions.Item label="Baseline">
            <Select
              value={selectedBaseline || undefined}
              onChange={onSelectBaseline}
              placeholder="选择冻结的 Baseline"
              style={{ width: "100%" }}
              notFoundContent={
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无可用 Baseline（V0：后端未实现）"
                />
              }
              options={baselines.map((b) => ({
                value: b.id,
                label: `${b.id} (${b.title})`,
              }))}
            />
          </Descriptions.Item>
          {selectedBaseline && (
            <>
              <Descriptions.Item label="Baseline Hash">
                <Text code style={{ fontSize: 12 }}>
                  {baselines.find((b) => b.id === selectedBaseline)?.hash ??
                    "—"}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="冻结时间">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {baselines.find((b) => b.id === selectedBaseline)?.frozenAt ??
                    "—"}
                </Text>
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Spin>
    </Space>
  );
}

// ── Step 2: 完整性检查 ──

function CompletenessStep({
  checks,
  loading,
  error,
}: {
  checks: ReadinessCheckDto[];
  loading: boolean;
  error: unknown;
}) {
  const columns: ColumnsType<ReadinessCheckDto> = [
    {
      title: "检查项",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: ReadinessCheckStatus) => (
        <Tag color={READINESS_CHECK_STATUS_COLOR[status]}>
          {READINESS_CHECK_STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: "详情",
      dataIndex: "detail",
      key: "detail",
      render: (detail: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {detail}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>完整性 &amp; 依赖检查</Title>
      <Paragraph type="secondary">
        自动检查所有依赖项是否就绪。阻断项必须关闭后才能继续；警告项需在下一步显式确认处置。
      </Paragraph>

      {error ? (
        <DataErrorAlert error={error} context="完整性检查" variant="inline" />
      ) : null}

      <Spin spinning={loading}>
        {checks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无完整性检查（V0：后端未实现）"
            style={{ padding: 32 }}
          />
        ) : (
          <Table<ReadinessCheckDto>
            rowKey="id"
            columns={columns}
            dataSource={checks}
            pagination={false}
            size="small"
          />
        )}
      </Spin>
    </Space>
  );
}

// ── Step 3: 证据审查 ──

function EvidenceStep({
  evidence,
  checks,
  acknowledged,
  onAcknowledgeChange,
  loading,
  error,
}: {
  evidence: EvidenceItemDto[];
  checks: ReadinessCheckDto[];
  acknowledged: string[];
  onAcknowledgeChange: (ids: string[]) => void;
  loading: boolean;
  error: unknown;
}) {
  const toggleAck = (id: string) => {
    if (acknowledged.includes(id)) {
      onAcknowledgeChange(acknowledged.filter((x) => x !== id));
    } else {
      onAcknowledgeChange([...acknowledged, id]);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>证据审查（版本差异 / Issue / 规则 / AI 分析）</Title>

      {error ? (
        <DataErrorAlert error={error} context="证据列表" variant="inline" />
      ) : null}

      <Spin spinning={loading}>
        <Card size="small" title="关联证据">
          {evidence.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无关联证据（V0：后端未实现）"
              style={{ padding: 24 }}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={evidence}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Tag color={EVIDENCE_OUTCOME_COLOR[item.outcome]}>
                        {EVIDENCE_OUTCOME_LABEL[item.outcome]}
                      </Tag>
                    }
                    title={
                      <Space>
                        <Text strong>{item.title}</Text>
                        <Tag color="blue">{EVIDENCE_TYPE_LABEL[item.type]}</Tag>
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        引用: {item.referenceId}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Spin>

      {checks.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: "#d97706" }} />
              <span>需确认的警告项</span>
              <Tag color="warning">{checks.length}</Tag>
            </Space>
          }
        >
          <Alert
            type="warning"
            showIcon
            message="所有 warning 必须显式确认处置，不默认勾选"
            style={{ marginBottom: 12 }}
          />
          <List
            itemLayout="horizontal"
            dataSource={checks}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Checkbox
                      checked={acknowledged.includes(item.id)}
                      onChange={() => toggleAck(item.id)}
                    />
                  }
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      <Tag color={READINESS_CHECK_STATUS_COLOR[item.status]}>
                        {READINESS_CHECK_STATUS_LABEL[item.status]}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.detail}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
}

// ── Step 4: 专业复核 ──

function ReviewsStep({
  reviewers,
  loading,
  error,
}: {
  reviewers: ReviewerDecisionDto[];
  loading: boolean;
  error: unknown;
}) {
  const columns: ColumnsType<ReviewerDecisionDto> = [
    {
      title: "专业",
      dataIndex: "discipline",
      key: "discipline",
      width: 100,
      render: (d: string) => <Tag color="blue">{d}</Tag>,
    },
    {
      title: "评审人",
      dataIndex: "reviewerName",
      key: "reviewerName",
      width: 140,
    },
    {
      title: "决策",
      dataIndex: "decision",
      key: "decision",
      width: 130,
      render: (decision: ReviewerDecisionValue) => (
        <Tag color={REVIEWER_DECISION_COLOR[decision]}>
          {REVIEWER_DECISION_LABEL[decision]}
        </Tag>
      ),
    },
    {
      title: "理由",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (reason?: string | null) =>
        reason ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reason}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>专业复核 &amp; 职责分离</Title>
      <Paragraph type="secondary">
        每个专业必须给出明确决策（Accept/Return/Reject/Conditional），所有
        PENDING 评审必须先完成。Conditional 须有责任人/期限/影响范围。
      </Paragraph>
      <Alert
        type="info"
        showIcon
        message="职责分离（SoD）"
        description="批准与发布不可由同一账号完成。最终提交须由与审批人不同的账号执行。"
      />

      {error ? (
        <DataErrorAlert error={error} context="复核矩阵" variant="inline" />
      ) : null}

      <Spin spinning={loading}>
        {reviewers.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无复核矩阵（V0：后端未实现）"
            style={{ padding: 32 }}
          />
        ) : (
          <Table<ReviewerDecisionDto>
            rowKey="id"
            columns={columns}
            dataSource={reviewers}
            pagination={false}
            size="small"
          />
        )}
      </Spin>
    </Space>
  );
}

// ── Step 5: 发布清单 ──

function ManifestStep({
  recipients,
  onRecipientsChange,
  retentionDays,
  onRetentionDaysChange,
  requiredSignatures,
  onRequiredSignaturesChange,
}: {
  recipients: string[];
  onRecipientsChange: (val: string[]) => void;
  retentionDays: number;
  onRetentionDaysChange: (val: number) => void;
  requiredSignatures: SignatureRole[];
  onRequiredSignaturesChange: (val: SignatureRole[]) => void;
}) {
  const recipientOptions: CheckboxOptionType[] = [
    { label: "业主代表", value: "OWNER_REP" },
    { label: "总包单位", value: "CONTRACTOR" },
    { label: "监理单位", value: "SUPERVISOR" },
    { label: "归档系统", value: "ARCHIVE" },
    { label: "审批机关", value: "AUTHORITY" },
    { label: "项目内部团队", value: "INTERNAL" },
  ];

  const signatureOptions: CheckboxOptionType[] = (
    Object.keys(SIGNATURE_ROLE_LABEL) as SignatureRole[]
  ).map((role) => ({
    label: SIGNATURE_ROLE_LABEL[role],
    value: role,
  }));

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>发布清单 / 收件人 / 留存期</Title>
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="收件人（多选）">
          <Checkbox.Group
            options={recipientOptions}
            value={recipients}
            onChange={(vals) => onRecipientsChange(vals as string[])}
          />
        </Descriptions.Item>
        <Descriptions.Item label="留存期（天）">
          <Select
            value={retentionDays}
            onChange={onRetentionDaysChange}
            style={{ width: 200 }}
            options={[
              { value: 90, label: "90 天（短期）" },
              { value: 365, label: "1 年" },
              { value: 1825, label: "5 年" },
              { value: 3650, label: "10 年（合规默认）" },
              { value: 10950, label: "30 年（长期归档）" },
            ]}
          />
        </Descriptions.Item>
        <Descriptions.Item label="签名要求">
          <Checkbox.Group
            options={signatureOptions}
            value={requiredSignatures}
            onChange={(vals) =>
              onRequiredSignaturesChange(vals as SignatureRole[])
            }
          />
        </Descriptions.Item>
        <Descriptions.Item label="对象锁定">
          <Tag color="blue">启用（不可篡改）</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="归档包">
          <Tag color="blue">自动生成</Tag>
        </Descriptions.Item>
      </Descriptions>
      <Alert
        type="info"
        showIcon
        message="留存期与法规对齐"
        description="V1 阶段留存期须符合当地法规（如 ISO 19650 § archival requirements）。当前默认 10 年，可按项目合同调整。"
      />
    </Space>
  );
}

// ── Step 6: 二次确认 ──

function SubmitStep({
  title,
  baseline,
  stepUpReason,
  onStepUpReasonChange,
  stepUpToken,
  onStepUpTokenChange,
  responsibilityAcknowledged,
  onResponsibilityAcknowledgedChange,
  blockingCount,
  warningCount,
  pendingReviewerCount,
}: {
  title: string;
  baseline: string;
  stepUpReason: string;
  onStepUpReasonChange: (val: string) => void;
  stepUpToken: string;
  onStepUpTokenChange: (val: string) => void;
  responsibilityAcknowledged: boolean;
  onResponsibilityAcknowledgedChange: (val: boolean) => void;
  blockingCount: number;
  warningCount: number;
  pendingReviewerCount: number;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={5}>
        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
        Step-up 二次确认
      </Title>
      <Alert
        type="warning"
        showIcon
        message="此操作不可逆"
        description="发布后 Baseline 不可修改，对象将被锁定，签名与证据不可篡改。请确认所有信息无误。"
      />
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="发布标题">{title}</Descriptions.Item>
        <Descriptions.Item label="Baseline">
          <Text code>{baseline}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="阻断项">
          <Tag color={blockingCount === 0 ? "success" : "error"}>
            {blockingCount}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="警告项">
          <Tag color={warningCount === 0 ? "success" : "warning"}>
            {warningCount}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="待评审">
          <Tag color={pendingReviewerCount === 0 ? "success" : "processing"}>
            {pendingReviewerCount}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          请说明本次发布的理由（≥10 字符）：
        </Text>
        <TextArea
          value={stepUpReason}
          onChange={(e) => onStepUpReasonChange(e.target.value)}
          placeholder="如：所有阻断项已关闭，专业评审已完成，Baseline 已冻结，可正式发布给业主与归档系统。"
          rows={4}
          maxLength={1024}
          style={{ marginTop: 4 }}
        />
        <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
          {stepUpReason.length} / 1024 字符
        </Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Step-up Token（高风险操作必填）：
        </Text>
        <Input.Password
          value={stepUpToken}
          onChange={(e) => onStepUpTokenChange(e.target.value)}
          placeholder="请输入二次认证 Token"
          style={{ marginTop: 4 }}
        />
      </div>
      <Alert
        type="warning"
        showIcon
        message="责任确认（必须勾选）"
        description={
          <Checkbox
            checked={responsibilityAcknowledged}
            onChange={(e) =>
              onResponsibilityAcknowledgedChange(e.target.checked)
            }
          >
            <Text strong>
              我确认：本次发布不可逆，Baseline
              不可修改，签章后对象锁定；所有发布必须由注册建筑师 /
              工程师签章，AI 输出不替代专业审签和监管审批。
            </Text>
          </Checkbox>
        }
      />
    </Space>
  );
}

// ── Step 7: 完成回执 ──

function ReceiptStep({
  submitted,
  detail,
  title,
  baseline,
}: {
  submitted: boolean;
  detail: PublicationDetailDto | null;
  title: string;
  baseline: string;
}) {
  if (!submitted) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={4}>
            <Text type="secondary">发布请求待提交</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完成上一步的 Step-up 确认并点击&quot;提交发布&quot;
            </Text>
          </Space>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message="发布请求已提交"
        description="后端 Operation 已启动：sealing → signing → object lock → notification。请关注右侧操作阶段进度。"
      />

      <Card size="small" title="发布回执">
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Publication ID">
            <Text code copyable>
              {detail?.id ?? "—"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="发布标题">
            {detail?.title ?? title}
          </Descriptions.Item>
          <Descriptions.Item label="Baseline">
            <Space>
              <Text code>{detail?.baselineId ?? baseline}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {detail?.baselineHash ?? "—"}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="提交时间">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {detail?.updatedAt ?? new Date().toISOString()}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={PUBLICATION_STATUS_COLOR[detail?.status ?? "PUBLISHING"]}
            >
              {PUBLICATION_STATUS_LABEL[detail?.status ?? "PUBLISHING"]}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 发布阶段进度（对齐 D37.15 §Operation） */}
      <Card size="small" title="发布阶段进度">
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          {(["SEALING", "SIGNING", "OBJECT_LOCK", "NOTIFICATION"] as const).map(
            (phase) => {
              const op = detail?.operations?.find((o) => o.phase === phase);
              const status = op?.status ?? "PENDING";
              return (
                <Space key={phase} size="middle">
                  <Tag
                    color={
                      status === "COMPLETED"
                        ? "success"
                        : status === "IN_PROGRESS"
                          ? "processing"
                          : status === "FAILED"
                            ? "error"
                            : "default"
                    }
                  >
                    {status === "PENDING"
                      ? "待执行"
                      : status === "IN_PROGRESS"
                        ? "执行中"
                        : status === "COMPLETED"
                          ? "已完成"
                          : "失败"}
                  </Tag>
                  <Text>{phase}</Text>
                  {op?.startedAt && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      开始: {new Date(op.startedAt).toLocaleString()}
                    </Text>
                  )}
                  {op?.completedAt && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      完成: {new Date(op.completedAt).toLocaleString()}
                    </Text>
                  )}
                  {op?.failureReason && (
                    <Text type="danger" style={{ fontSize: 11 }}>
                      失败原因: {op.failureReason}
                    </Text>
                  )}
                </Space>
              );
            },
          )}
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="后续动作"
        description={
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>1. 通知收件人并生成下载链接</Text>
            <Text style={{ fontSize: 12 }}>
              2. 收集电子签名（注册建筑师 / 结构工程师 / 项目经理）
            </Text>
            <Text style={{ fontSize: 12 }}>3. 锁定对象（防修改）</Text>
            <Text style={{ fontSize: 12 }}>4. 推送归档系统</Text>
          </Space>
        }
      />
    </Space>
  );
}
