"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  List,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  App,
} from "antd";
import {
  ArrowLeftOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  AFFECTED_ACTION_COLOR,
  AFFECTED_ACTION_LABEL,
  AFFECTED_OBJECT_TYPE_LABEL,
  type AffectedItemDto,
  type AffectedObjectType,
  CLOSURE_EVIDENCE_STATUS_COLOR,
  CLOSURE_EVIDENCE_STATUS_LABEL,
  CLOSURE_EVIDENCE_TYPE_LABEL,
  CHANGE_OPERATION_PHASE_LABEL,
  CHANGE_OPERATION_PHASE_STATUS_COLOR,
  CHANGE_OPERATION_PHASE_STATUS_LABEL,
  CHANGE_PRIORITY_COLOR,
  CHANGE_PRIORITY_LABEL,
  CHANGE_STATUS_COLOR,
  CHANGE_STATUS_LABEL,
  CHANGE_TYPE_LABEL,
  type ChangeOperationPhase,
  type ChangeOperationPhaseDto,
  type ChangeRequestDetailDto,
  type ClosureEvidenceItemDto,
  type ClosureEvidenceType,
  type TaskPlanItemDto,
  type TaskPlanStatus,
  TASK_PLAN_STATUS_COLOR,
  TASK_PLAN_STATUS_LABEL,
} from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import {
  useApproveChangeRequest,
  useChangeOperations,
  useChangeRequestDetail,
  useClosureEvidences,
  useGenerateTaskPlan,
  useRejectChangeRequest,
  useSubmitImpactAssessment,
  useTaskPlans,
  useVerifyClosure,
} from "@/hooks/use-changes";
import { useStepUpToken } from "@/hooks/use-step-up";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * P12 变更影响与闭环工作台 — 详情页（D37.16）
 *
 * 路由：/changes/{changeId}
 *
 * 布局（对齐 D37.16）：
 *  - Change Header: 编号/标题/状态/类型/优先级/发起人/批准人/时间
 *  - Tabs: 来源/理由 | 影响图 | 受影响对象 | 处置计划 | 关闭证据 | 操作阶段
 *  - 底部操作栏: 提交评估 / 批准 / 生成任务 / 验证关闭（按状态条件显示）
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 ChangeRequest API 未实现，hook 返回 404/501 时显示空状态
 *  - 不伪造数据（对齐 D37 §空状态红线）
 *  - 主动作按钮尝试调用真实 API，失败时显示提示
 *
 * 主动作约束（D37.16 §主动作）：
 *  - 批准与实施/关闭职责分离
 *  - 不能在同一账号下完成批准+实施+关闭
 *  - 高风险变更（CRITICAL 优先级）强制 stepUpToken 二次认证
 *  - Unknown 影响项阻断高风险关闭
 */

export default function ChangeDetailPage({
  params,
}: {
  params: Promise<{ changeId: string }>;
}) {
  const { changeId } = use(params);
  const router = useRouter();
  const { message, modal } = App.useApp();

  const [activeTab, setActiveTab] = useState("source");
  const [approvalComment, setApprovalComment] = useState("");
  const [closureComment, setClosureComment] = useState("");

  // 数据 hooks
  const detailQuery = useChangeRequestDetail(changeId);
  const taskPlansQuery = useTaskPlans(changeId);
  const closureEvidencesQuery = useClosureEvidences(changeId);
  const operationsQuery = useChangeOperations(changeId);

  // 主动作 mutation hooks（5 个，接入真实 API）
  const submitAssessmentMutation = useSubmitImpactAssessment();
  const approveMutation = useApproveChangeRequest();
  const rejectMutation = useRejectChangeRequest();
  const generateTaskPlanMutation = useGenerateTaskPlan();
  const verifyClosureMutation = useVerifyClosure();
  const stepUpMutation = useStepUpToken();

  const detail = detailQuery.data;
  const isLoading = detailQuery.isLoading;
  const error = detailQuery.error;

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

  if (error || !detail) {
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/changes")}
          style={{ paddingLeft: 0 }}
        >
          返回变更列表
        </Button>
        <DataErrorAlert
          error={error ?? new Error("未找到变更请求")}
          context="变更请求详情"
          variant="inline"
          onRetry={() => void detailQuery.refetch()}
          retryLabel="重试"
        />
      </Space>
    );
  }

  // 派生数据
  const taskPlans = taskPlansQuery.data ?? [];
  const closureEvidences = closureEvidencesQuery.data ?? [];
  const operations = operationsQuery.data ?? [];

  // 状态对应可用动作（对齐 D37.16 §主动作：批准与实施/关闭职责分离）
  const canSubmitAssessment = detail.status === "IMPACT_ASSESSMENT";
  const canApprove = detail.status === "PENDING_APPROVAL";
  const canGenerateTasks = detail.status === "APPROVED";
  const canVerifyClosure = detail.status === "IN_PROGRESS";

  // 通用 step-up token 申请：高风险动作前调用 /auth/step-up 签发 5 分钟短期 token
  const requireStepUpToken = async (
    purpose: string,
  ): Promise<string | null> => {
    let currentPassword = "";
    return new Promise<string | null>((resolve) => {
      modal.confirm({
        title: "二次认证（Step-up）",
        icon: <SafetyCertificateOutlined />,
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text>此操作为高风险动作，需要二次认证。</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              用途：{purpose}
            </Text>
            <Input.Password
              placeholder="当前用户密码"
              onChange={(e) => {
                currentPassword = e.target.value;
              }}
              autoFocus
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Step-up token 5 分钟内有效，仅可用于本次操作。
            </Text>
          </Space>
        ),
        okText: "确认认证",
        cancelText: "取消",
        onOk: async () => {
          if (!currentPassword) {
            message.error("请输入当前用户密码");
            resolve(null);
            return;
          }
          try {
            const { stepUpToken } = await stepUpMutation.mutateAsync({
              currentPassword,
              purpose,
            });
            resolve(stepUpToken);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "认证失败";
            message.error(errMsg);
            resolve(null);
          }
        },
        onCancel: () => resolve(null),
      });
    });
  };

  // 提交影响评估（IMPACT_ASSESSMENT → PENDING_APPROVAL）
  const handleSubmitAssessment = async () => {
    const stepUpToken = await requireStepUpToken("提交影响评估结论");
    if (!stepUpToken) return;
    let impactAssessment = "";
    modal.confirm({
      title: "提交影响评估结论",
      icon: <FileSearchOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>提交后变更请求进入待批准状态，由批准人审查。</Text>
          <TextArea
            placeholder="影响评估结论说明（可选）"
            rows={4}
            onChange={(e) => {
              impactAssessment = e.target.value;
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            确认无影响时，需明确 confirmedNoImpact=true；若存在 Unknown
            影响项，将阻断关闭。
          </Text>
        </Space>
      ),
      okText: "确认提交",
      okType: "primary",
      cancelText: "取消",
      onOk: async () => {
        try {
          await submitAssessmentMutation.mutateAsync({
            changeId,
            impactAssessment,
            confirmedNoImpact: false,
            stepUpToken,
          });
          message.success("影响评估已提交");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "提交失败";
          message.error(errMsg);
          throw err;
        }
      },
    });
  };

  // 批准变更（PENDING_APPROVAL → APPROVED，需 stepUpToken + 责任确认）
  const handleApprove = async () => {
    const stepUpToken =
      await requireStepUpToken("批准变更（进入实施阶段，不可逆）");
    if (!stepUpToken) return;
    let comment = approvalComment;
    modal.confirm({
      title: "批准变更请求",
      icon: <CheckCircleOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="职责分离原则"
            description="批准人不可兼任实施人或关闭验证人。批准后变更进入实施阶段，不可逆。"
          />
          <TextArea
            placeholder="批准意见（必填）"
            rows={4}
            defaultValue={comment}
            onChange={(e) => {
              comment = e.target.value;
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            提交即代表确认承担责任（responsibilityAcknowledged=true）
          </Text>
        </Space>
      ),
      okText: "确认批准",
      okType: "primary",
      okButtonProps: { loading: approveMutation.isPending },
      cancelText: "取消",
      onOk: async () => {
        if (!comment.trim()) {
          message.error("请填写批准意见");
          throw new Error("批准意见不能为空");
        }
        try {
          await approveMutation.mutateAsync({
            changeId,
            comment,
            stepUpToken,
            responsibilityAcknowledged: true,
          });
          setApprovalComment("");
          message.success("变更已批准，进入实施阶段");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "批准失败";
          message.error(errMsg);
          throw err;
        }
      },
    });
  };

  // 拒绝变更（需 stepUpToken + reason）
  const handleReject = async () => {
    const stepUpToken = await requireStepUpToken("拒绝变更请求");
    if (!stepUpToken) return;
    let reason = "";
    modal.confirm({
      title: "拒绝变更请求",
      icon: <CloseCircleOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text type="danger">拒绝后变更请求将进入 REJECTED 终态。</Text>
          <TextArea
            placeholder="拒绝原因（必填）"
            rows={4}
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </Space>
      ),
      okText: "确认拒绝",
      okType: "danger",
      okButtonProps: { loading: rejectMutation.isPending },
      cancelText: "取消",
      onOk: async () => {
        if (!reason.trim()) {
          message.error("请填写拒绝原因");
          throw new Error("拒绝原因不能为空");
        }
        try {
          await rejectMutation.mutateAsync({ changeId, reason, stepUpToken });
          message.success("变更已拒绝");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "拒绝失败";
          message.error(errMsg);
          throw err;
        }
      },
    });
  };

  // 生成处置任务（APPROVED → IN_PROGRESS，无需 stepUpToken）
  const handleGenerateTasks = () => {
    modal.confirm({
      title: "生成处置任务清单",
      icon: <PlusOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>
            基于影响项自动生成处置任务清单，生成后变更请求进入实施阶段。
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            策略：AUTO（基于影响项类型与优先级自动分配）
          </Text>
        </Space>
      ),
      okText: "确认生成",
      okType: "primary",
      okButtonProps: { loading: generateTaskPlanMutation.isPending },
      cancelText: "取消",
      onOk: async () => {
        try {
          const tasks = await generateTaskPlanMutation.mutateAsync({
            changeId,
            strategy: "AUTO",
          });
          message.success(`已生成 ${tasks.length} 个处置任务`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "生成失败";
          message.error(errMsg);
          throw err;
        }
      },
    });
  };

  // 验证关闭（IN_PROGRESS → CLOSED，需 stepUpToken + 责任确认）
  const handleVerifyClosure = async () => {
    const stepUpToken =
      await requireStepUpToken("验证关闭（变更进入终态，不可逆）");
    if (!stepUpToken) return;
    let comment = closureComment;
    modal.confirm({
      title: "验证关闭变更",
      icon: <SafetyCertificateOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="关闭即终态"
            description="关闭后变更请求进入 CLOSED 终态，不可逆。关闭人与批准人/实施人职责分离。"
          />
          <TextArea
            placeholder="关闭验证意见（必填）"
            rows={4}
            defaultValue={comment}
            onChange={(e) => {
              comment = e.target.value;
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            提交即代表确认承担责任（responsibilityAcknowledged=true）
          </Text>
        </Space>
      ),
      okText: "确认关闭",
      okType: "danger",
      okButtonProps: { loading: verifyClosureMutation.isPending },
      cancelText: "取消",
      onOk: async () => {
        if (!comment.trim()) {
          message.error("请填写关闭验证意见");
          throw new Error("关闭验证意见不能为空");
        }
        try {
          await verifyClosureMutation.mutateAsync({
            changeId,
            verificationResult: "PASSED",
            comment,
            stepUpToken,
            responsibilityAcknowledged: true,
          });
          setClosureComment("");
          message.success("变更已关闭");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "关闭失败";
          message.error(errMsg);
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
          onClick={() => router.push("/changes")}
          style={{ paddingLeft: 0 }}
        >
          返回变更列表
        </Button>
        <Tooltip title="刷新详情">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void detailQuery.refetch();
              void taskPlansQuery.refetch();
              void closureEvidencesQuery.refetch();
              void operationsQuery.refetch();
            }}
            loading={
              detailQuery.isFetching ||
              taskPlansQuery.isFetching ||
              closureEvidencesQuery.isFetching ||
              operationsQuery.isFetching
            }
          >
            刷新
          </Button>
        </Tooltip>
      </div>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="变更管理 API 对接真实后端"
        description="前端主动作按钮已接入真实 BFF / Core API（提交评估 / 批准 / 拒绝 / 生成任务 / 验证关闭）；后端返回 404/501 时组件显示错误状态，不伪造数据。高风险动作（批准 / 拒绝 / 关闭）需 stepUpToken 二次认证。"
      />

      {/* Change Header（对齐 D37.16 §Change header） */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {/* 第一行：标题 + 状态 */}
          <Space align="center" wrap>
            <Title level={3} style={{ margin: 0 }}>
              <BranchesOutlined style={{ marginRight: 8 }} />
              {detail.title}
            </Title>
            <Tag color={CHANGE_STATUS_COLOR[detail.status]}>
              {CHANGE_STATUS_LABEL[detail.status]}
            </Tag>
            <Tag color="geekblue">{CHANGE_TYPE_LABEL[detail.type]}</Tag>
            <Tag color={CHANGE_PRIORITY_COLOR[detail.priority]}>
              {CHANGE_PRIORITY_LABEL[detail.priority]}
            </Tag>
          </Space>

          {/* 第二行：基本信息 */}
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 4 }}
            style={{ margin: 0 }}
          >
            <Descriptions.Item label="变更编号">
              <Text code copyable>
                {detail.code}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="发起人">
              <Space size={4}>
                <Text>{detail.requesterName ?? detail.requesterId}</Text>
                {detail.requesterRole ? (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ({detail.requesterRole})
                  </Text>
                ) : null}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="批准人">
              {detail.approverName ? (
                <Space size={4}>
                  <Text>{detail.approverName}</Text>
                  {detail.approverRole ? (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ({detail.approverRole})
                    </Text>
                  ) : null}
                </Space>
              ) : (
                <Text type="secondary">未指定</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="受影响对象">
              <Tag color="orange">{detail.affectedItemCount} 项</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(detail.createdAt).toLocaleString()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(detail.updatedAt).toLocaleString()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="批准时间">
              {detail.approvedAt ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(detail.approvedAt).toLocaleString()}
                </Text>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="关闭时间">
              {detail.closedAt ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(detail.closedAt).toLocaleString()}
                </Text>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {/* AI 辅助标记 */}
          {detail.isAiAssisted && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="AI 辅助影响分析"
              description="本变更的影响分析由 AI 辅助生成，须人工确认。AI 不替代注册建筑师/工程师的专业判断。"
            />
          )}
        </Space>
      </Card>

      {/* Tabs 主体（对齐 D37.16 §布局） */}
      <Card size="small" bodyStyle={{ padding: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "source",
              label: (
                <span>
                  <FileSearchOutlined /> 来源 &amp; 理由
                </span>
              ),
              children: <SourceRationalePanel detail={detail} />,
            },
            {
              key: "impact",
              label: (
                <span>
                  <NodeIndexOutlined /> 影响图 / 矩阵
                </span>
              ),
              children: (
                <ImpactGraphPanel
                  detail={detail}
                  affectedItems={detail.affectedItems}
                />
              ),
            },
            {
              key: "affected",
              label: (
                <span>
                  受影响对象
                  <Tag color="orange" style={{ marginLeft: 4 }}>
                    {detail.affectedItems.length}
                  </Tag>
                </span>
              ),
              children: <AffectedItemsPanel items={detail.affectedItems} />,
            },
            {
              key: "task-plan",
              label: (
                <span>
                  处置计划
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {taskPlans.length}
                  </Tag>
                </span>
              ),
              children: <TaskPlanPanel tasks={taskPlans} />,
            },
            {
              key: "closure",
              label: (
                <span>
                  <SafetyCertificateOutlined /> 关闭证据
                </span>
              ),
              children: (
                <ClosureEvidencePanel
                  evidence={closureEvidences}
                  closureComment={closureComment}
                  onClosureCommentChange={setClosureComment}
                />
              ),
            },
            {
              key: "operations",
              label: (
                <span>
                  <ClockCircleOutlined /> 操作阶段
                </span>
              ),
              children: <OperationsPanel operations={operations} />,
            },
          ]}
        />
      </Card>

      {/* 底部操作栏（对齐 D37.16 §主动作：职责分离） */}
      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="职责分离原则"
            description="批准人不可兼任实施人或关闭验证人。同一账号不可完成批准→实施→关闭全流程，须由不同角色接力。"
          />
          <Space wrap size="middle">
            <Tooltip
              title={
                canSubmitAssessment
                  ? "提交影响评估结论，进入待批准状态"
                  : "当前状态不允许提交评估"
              }
            >
              <Button
                type="primary"
                disabled={!canSubmitAssessment}
                loading={submitAssessmentMutation.isPending}
                onClick={handleSubmitAssessment}
              >
                提交影响评估
              </Button>
            </Tooltip>
            <Tooltip
              title={
                canApprove
                  ? "批准变更进入实施阶段（需 stepUpToken + 责任确认）"
                  : "需先提交影响评估"
              }
            >
              <Button
                type="primary"
                disabled={!canApprove}
                loading={approveMutation.isPending}
                icon={<CheckCircleOutlined />}
                onClick={handleApprove}
              >
                批准变更
              </Button>
            </Tooltip>
            <Tooltip
              title={
                canGenerateTasks ? "基于影响项生成处置任务清单" : "需先批准变更"
              }
            >
              <Button
                disabled={!canGenerateTasks}
                loading={generateTaskPlanMutation.isPending}
                icon={<PlusOutlined />}
                onClick={handleGenerateTasks}
              >
                生成处置任务
              </Button>
            </Tooltip>
            <Tooltip
              title={
                canVerifyClosure
                  ? "验证关闭证据并关闭变更（需 stepUpToken + 责任确认）"
                  : "需先完成实施"
              }
            >
              <Button
                type="primary"
                danger
                disabled={!canVerifyClosure}
                loading={verifyClosureMutation.isPending}
                icon={<SafetyCertificateOutlined />}
                onClick={handleVerifyClosure}
              >
                验证关闭
              </Button>
            </Tooltip>
            <Tooltip title="拒绝变更并说明原因">
              <Button
                disabled={!canApprove}
                loading={rejectMutation.isPending}
                icon={<CloseCircleOutlined />}
                onClick={handleReject}
              >
                拒绝变更
              </Button>
            </Tooltip>
            <Input.TextArea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder="批准 / 拒绝批注（V0：占位）"
              rows={1}
              style={{ width: 400 }}
            />
          </Space>
        </Space>
      </Card>
    </Space>
  );
}

// ── 子组件：来源/理由面板 ──

function SourceRationalePanel({ detail }: { detail: ChangeRequestDetailDto }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions title="变更来源" size="small" column={1} bordered>
        <Descriptions.Item label="来源描述">
          <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {detail.source}
          </Paragraph>
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="变更理由" size="small" column={1} bordered>
        <Descriptions.Item label="理由说明">
          <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {detail.rationale}
          </Paragraph>
        </Descriptions.Item>
      </Descriptions>

      {detail.impactAssessment ? (
        <Descriptions title="影响评估结论" size="small" column={1} bordered>
          <Descriptions.Item label="评估结论">
            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {detail.impactAssessment}
            </Paragraph>
          </Descriptions.Item>
          {detail.impactAssessor ? (
            <Descriptions.Item label="评估人">
              <Text>{detail.impactAssessor}</Text>
              {detail.impactAssessedAt ? (
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  · {new Date(detail.impactAssessedAt).toLocaleString()}
                </Text>
              ) : null}
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">尚未进行影响评估</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                &quot;尚未分析&quot;与&quot;确认无影响&quot;严格分离（对齐
                D37.16 §空/未知）
              </Text>
            </Space>
          }
        />
      )}

      {/* 变更时间线 */}
      <Card size="small" title="变更时间线">
        <Timeline
          items={[
            {
              color: "green",
              dot: <ClockCircleOutlined />,
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>变更发起</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {detail.requesterName ?? detail.requesterId} ·{" "}
                    {new Date(detail.createdAt).toLocaleString()}
                  </Text>
                </Space>
              ),
            },
            {
              color:
                detail.status === "IMPACT_ASSESSMENT" ||
                detail.status === "DRAFT"
                  ? "blue"
                  : "green",
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>影响评估</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    识别 {detail.affectedItemCount} 项受影响对象
                  </Text>
                </Space>
              ),
            },
            {
              color: detail.approvedAt
                ? "green"
                : detail.status === "PENDING_APPROVAL"
                  ? "blue"
                  : "gray",
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>批准</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {detail.approverName
                      ? `批准人: ${detail.approverName}`
                      : "待批准"}
                  </Text>
                </Space>
              ),
            },
            {
              color: detail.status === "IN_PROGRESS" ? "blue" : "gray",
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>实施</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {detail.implementerId
                      ? `实施人: ${detail.implementerId}`
                      : "待生成处置任务"}
                  </Text>
                </Space>
              ),
            },
            {
              color: detail.closedAt ? "green" : "gray",
              children: (
                <Space direction="vertical" size={0}>
                  <Text strong>关闭验证</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {detail.closerId
                      ? `关闭人: ${detail.closerId}`
                      : detail.closedAt
                        ? "已关闭"
                        : "待验证关闭"}
                  </Text>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

// ── 子组件：影响图/矩阵面板 ──

function ImpactGraphPanel({
  detail,
  affectedItems,
}: {
  detail: ChangeRequestDetailDto;
  affectedItems: AffectedItemDto[];
}) {
  // 按对象类型分组统计
  const grouped = new Map<
    AffectedObjectType,
    { ADDED: number; MODIFIED: number; REMOVED: number }
  >();
  for (const item of affectedItems) {
    const entry = grouped.get(item.type) ?? {
      ADDED: 0,
      MODIFIED: 0,
      REMOVED: 0,
    };
    entry[item.action] += 1;
    grouped.set(item.type, entry);
  }
  const matrixData = Array.from(grouped.entries()).map(([type, counts]) => ({
    key: type,
    type,
    ...counts,
    total: counts.ADDED + counts.MODIFIED + counts.REMOVED,
  }));

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="影响图（V0 占位）"
        description="V1 阶段将提供可视化影响图：以变更请求为中心，向外辐射到受影响的需求/模型/图纸/规则等对象，并标注影响类型（新增/修改/删除）与复核状态。"
      />

      {/* 影响统计矩阵（按对象类型分组） */}
      <Card size="small" title="影响矩阵（按对象类型）">
        {affectedItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">暂无受影响对象</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  需先进行影响分析（后端 API 待 V1 实现）
                </Text>
              </Space>
            }
            style={{ padding: 24 }}
          />
        ) : (
          <Table
            size="small"
            rowKey="type"
            pagination={false}
            dataSource={matrixData}
            columns={[
              {
                title: "对象类型",
                dataIndex: "type",
                key: "type",
                render: (type: AffectedObjectType) => (
                  <Tag color="blue">{AFFECTED_OBJECT_TYPE_LABEL[type]}</Tag>
                ),
              },
              {
                title: "新增",
                dataIndex: "ADDED",
                key: "ADDED",
                align: "center",
                render: (v: number) =>
                  v > 0 ? (
                    <Tag color="green">+{v}</Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                title: "修改",
                dataIndex: "MODIFIED",
                key: "MODIFIED",
                align: "center",
                render: (v: number) =>
                  v > 0 ? (
                    <Tag color="orange">~{v}</Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                title: "删除",
                dataIndex: "REMOVED",
                key: "REMOVED",
                align: "center",
                render: (v: number) =>
                  v > 0 ? (
                    <Tag color="red">-{v}</Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                title: "合计",
                dataIndex: "total",
                key: "total",
                align: "center",
                render: (v: number) => <Text strong>{v}</Text>,
              },
            ]}
          />
        )}
      </Card>

      {/* 影响评估摘要 */}
      {detail.impactAssessment && (
        <Card size="small" title="影响评估摘要">
          <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {detail.impactAssessment}
          </Paragraph>
        </Card>
      )}

      <Card size="small" title="Trace 追踪（V0 占位）">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              V1 阶段接入 TraceLink API 后展示变更→需求→设计→验证的完整追踪图
            </Text>
          }
        />
      </Card>
    </Space>
  );
}

// ── 子组件：受影响对象面板 ──

function AffectedItemsPanel({ items }: { items: AffectedItemDto[] }) {
  const columns: ColumnsType<AffectedItemDto> = [
    {
      title: "对象类型",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (type: AffectedObjectType) => (
        <Tag color="blue">{AFFECTED_OBJECT_TYPE_LABEL[type]}</Tag>
      ),
    },
    {
      title: "编号",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "专业",
      dataIndex: "discipline",
      key: "discipline",
      width: 100,
      render: (d: string) => <Tag color="blue">{d}</Tag>,
    },
    {
      title: "动作",
      dataIndex: "action",
      key: "action",
      width: 90,
      render: (action: AffectedItemDto["action"]) => (
        <Tag color={AFFECTED_ACTION_COLOR[action]}>
          {AFFECTED_ACTION_LABEL[action]}
        </Tag>
      ),
    },
    {
      title: "影响",
      dataIndex: "impact",
      key: "impact",
      width: 100,
      render: (impact: AffectedItemDto["impact"]) => {
        const colorMap: Record<AffectedItemDto["impact"], string> = {
          CONFIRMED: "error",
          POTENTIAL: "warning",
          UNKNOWN: "default",
          NOT_AFFECTED: "success",
        };
        const labelMap: Record<AffectedItemDto["impact"], string> = {
          CONFIRMED: "已确认",
          POTENTIAL: "潜在",
          UNKNOWN: "未知",
          NOT_AFFECTED: "无影响",
        };
        return <Tag color={colorMap[impact]}>{labelMap[impact]}</Tag>;
      },
    },
    {
      title: "需复核",
      dataIndex: "recheckRequired",
      key: "recheckRequired",
      width: 90,
      align: "center",
      render: (v: boolean) =>
        v ? <Tag color="orange">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: "复核状态",
      dataIndex: "recheckStatus",
      key: "recheckStatus",
      width: 110,
      render: (status: AffectedItemDto["recheckStatus"]) => {
        const colorMap: Record<AffectedItemDto["recheckStatus"], string> = {
          PENDING: "default",
          IN_PROGRESS: "processing",
          COMPLETED: "success",
          NOT_APPLICABLE: "default",
        };
        const labelMap: Record<AffectedItemDto["recheckStatus"], string> = {
          PENDING: "待复核",
          IN_PROGRESS: "复核中",
          COMPLETED: "已完成",
          NOT_APPLICABLE: "不适用",
        };
        return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>;
      },
    },
    {
      title: "负责人",
      dataIndex: "owner",
      key: "owner",
      width: 120,
    },
  ];

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={4}>
            <Text type="secondary">暂无受影响对象</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              &quot;尚未分析&quot;与&quot;确认无影响&quot;严格分离，需先执行影响分析
            </Text>
          </Space>
        }
        style={{ padding: 48 }}
      />
    );
  }

  return (
    <Table<AffectedItemDto>
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={false}
      size="small"
      scroll={{ x: 1100 }}
    />
  );
}

// ── 子组件：处置计划面板 ──

function TaskPlanPanel({ tasks }: { tasks: TaskPlanItemDto[] }) {
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {tasks.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">暂无处置任务</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                变更批准后可基于受影响项生成处置任务清单
              </Text>
            </Space>
          }
          style={{ padding: 48 }}
        />
      ) : (
        <>
          {/* 进度概览 */}
          <Card size="small">
            <Space size="large" wrap>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  总任务数
                </Text>
                <Text strong style={{ fontSize: 20 }}>
                  {totalCount}
                </Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  已完成
                </Text>
                <Text strong style={{ fontSize: 20, color: "#16a34a" }}>
                  {doneCount}
                </Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  进行中
                </Text>
                <Text strong style={{ fontSize: 20, color: "#0891b2" }}>
                  {tasks.filter((t) => t.status === "IN_PROGRESS").length}
                </Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  待办
                </Text>
                <Text strong style={{ fontSize: 20, color: "#64748b" }}>
                  {tasks.filter((t) => t.status === "TODO").length}
                </Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  进度
                </Text>
                <Text strong style={{ fontSize: 20 }}>
                  {progress.toFixed(0)}%
                </Text>
              </Space>
            </Space>
          </Card>

          {/* 任务列表 */}
          <Table<TaskPlanItemDto>
            rowKey="id"
            columns={[
              {
                title: "任务",
                dataIndex: "title",
                key: "title",
                ellipsis: true,
              },
              {
                title: "负责人",
                dataIndex: "assignee",
                key: "assignee",
                width: 120,
              },
              {
                title: "状态",
                dataIndex: "status",
                key: "status",
                width: 110,
                render: (status: TaskPlanStatus) => (
                  <Tag color={TASK_PLAN_STATUS_COLOR[status]}>
                    {TASK_PLAN_STATUS_LABEL[status]}
                  </Tag>
                ),
              },
              {
                title: "截止日期",
                dataIndex: "dueDate",
                key: "dueDate",
                width: 120,
                render: (d: string) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(d).toLocaleDateString()}
                  </Text>
                ),
              },
              {
                title: "完成时间",
                dataIndex: "completedAt",
                key: "completedAt",
                width: 160,
                render: (v?: string | null) =>
                  v ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(v).toLocaleString()}
                    </Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
            ]}
            dataSource={tasks}
            pagination={false}
            size="small"
          />
        </>
      )}
    </Space>
  );
}

// ── 子组件：关闭证据面板 ──

function ClosureEvidencePanel({
  evidence,
  closureComment,
  onClosureCommentChange,
}: {
  evidence: ClosureEvidenceItemDto[];
  closureComment: string;
  onClosureCommentChange: (val: string) => void;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="关闭证据要求"
        description="关闭前须收集：设计评审记录、规则运行结果、AI 复核记录、专业签章。所有证据须关联到具体受影响对象，并通过 ETag 校验。"
      />

      {/* 证据列表 */}
      <Card size="small" title={`关闭证据（${evidence.length} 项）`}>
        {evidence.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">暂无关闭证据</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  实施阶段完成后自动收集证据（V1 实现）
                </Text>
              </Space>
            }
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
                    <Tag color={CLOSURE_EVIDENCE_STATUS_COLOR[item.status]}>
                      {CLOSURE_EVIDENCE_STATUS_LABEL[item.status]}
                    </Tag>
                  }
                  title={
                    <Space>
                      <Text strong>{item.title}</Text>
                      <Tag color="blue">
                        {CLOSURE_EVIDENCE_TYPE_LABEL[
                          item.type as ClosureEvidenceType
                        ] ?? item.type}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space split={<Text type="secondary">·</Text>}>
                      {item.verifiedBy ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          验证人: {item.verifiedBy}
                        </Text>
                      ) : null}
                      {item.verifiedAt ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.verifiedAt).toLocaleString()}
                        </Text>
                      ) : null}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        来源: {item.sourceId}
                      </Text>
                      {item.evidenceUrl ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          证据链接: {item.evidenceUrl}
                        </Text>
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 关闭批注 */}
      <Card size="small" title="关闭批注">
        <TextArea
          value={closureComment}
          onChange={(e) => onClosureCommentChange(e.target.value)}
          placeholder="关闭变更前填写总结性批注：影响范围确认、证据完整性、遗留风险..."
          rows={4}
          maxLength={2048}
        />
        <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
          {closureComment.length} / 2048 字符
        </Text>
      </Card>
    </Space>
  );
}

// ── 子组件：操作阶段时间线面板 ──

function OperationsPanel({
  operations,
}: {
  operations: ChangeOperationPhaseDto[];
}) {
  if (operations.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={4}>
            <Text type="secondary">暂无操作记录</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              变更进入下一阶段后将自动记录操作时间线
            </Text>
          </Space>
        }
        style={{ padding: 48 }}
      />
    );
  }

  return (
    <Card size="small" title={`操作阶段时间线（${operations.length} 项）`}>
      <Timeline
        items={operations.map((op) => ({
          color:
            op.status === "COMPLETED"
              ? "green"
              : op.status === "IN_PROGRESS"
                ? "blue"
                : op.status === "FAILED"
                  ? "red"
                  : "gray",
          children: (
            <Space direction="vertical" size={0}>
              <Space>
                <Text strong>
                  {CHANGE_OPERATION_PHASE_LABEL[
                    op.phase as ChangeOperationPhase
                  ] ?? op.phase}
                </Text>
                <Tag color={CHANGE_OPERATION_PHASE_STATUS_COLOR[op.status]}>
                  {CHANGE_OPERATION_PHASE_STATUS_LABEL[op.status]}
                </Tag>
              </Space>
              {op.operatorId ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  操作人: {op.operatorId}
                </Text>
              ) : null}
              {op.operatedAt ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(op.operatedAt).toLocaleString()}
                </Text>
              ) : null}
              {op.comment ? (
                <Paragraph
                  type="secondary"
                  style={{ fontSize: 12, margin: 0, whiteSpace: "pre-wrap" }}
                >
                  {op.comment}
                </Paragraph>
              ) : null}
            </Space>
          ),
        }))}
      />
    </Card>
  );
}
