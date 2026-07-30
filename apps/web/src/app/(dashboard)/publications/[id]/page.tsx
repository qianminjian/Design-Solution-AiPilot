"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  EVIDENCE_OUTCOME_COLOR,
  EVIDENCE_OUTCOME_LABEL,
  EVIDENCE_TYPE_LABEL,
  OPERATION_PHASE_LABEL,
  OPERATION_PHASE_STATUS_COLOR,
  OPERATION_PHASE_STATUS_LABEL,
  PUBLICATION_STATUS_COLOR,
  PUBLICATION_STATUS_LABEL,
  READINESS_CHECK_STATUS_COLOR,
  READINESS_CHECK_STATUS_LABEL,
  RECIPIENT_TYPE_LABEL,
  REVIEWER_DECISION_COLOR,
  REVIEWER_DECISION_LABEL,
  SIGNATURE_ROLE_LABEL,
  SIGNATURE_STATUS_COLOR,
  SIGNATURE_STATUS_LABEL,
  type EvidenceItemDto,
  type PublicationDetailDto,
  type PublicationOperationPhaseDto,
  type ReadinessCheckDto,
  type ReadinessCheckStatus,
  type RecipientDto,
  type RecipientType,
  type ReviewerDecisionDto,
  type ReviewerDecisionValue,
  type SignatureDto,
  type SignatureRole,
  type SignatureStatus,
} from "@design-platform/shared";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import {
  computeCheckStats,
  computeOperationStats,
  computeReviewerStats,
  computeSignatureStats,
  useDeletePublication,
  usePublicationDetail,
  useRecallPublication,
} from "@/hooks/use-publications";

const { Title, Text, Paragraph } = Typography;

/**
 * P11 发布详情页（D37.15）
 *
 * 路由：/publications/{id}
 *
 * V0 简化（前端骨架 + V1 API 对接预留）：
 *  - 后端 Publication API 未实现时显示空状态，不伪造数据
 *  - 使用 usePublicationDetail 拉取真实数据（含 checks/evidence/reviewers/signatures/recipients/operations）
 *  - 撤回 / 删除操作调用真实 mutation，后端未实现时显示错误 toast
 *
 * 对齐 D37.15：
 *  - 顶部 PublicationHeader：编号 / 标题 / 状态 / Baseline / 发布人 / 时间
 *  - 中部统计卡：阻断 / 警告 / 待评审 / 签名进度
 *  - Tab 切换：概览 / 完整性检查 / 证据 / 复核决策 / 签名 / 收件人 / 操作阶段
 *  - 主动作：撤回发布（PUBLISHED/READY_TO_PUBLISH）、删除草稿（DRAFT）
 *
 * 安全红线（design-constraints.md）：
 *  - 所有发布必须由注册建筑师 / 工程师签章
 *  - 签名后对象锁定，不可篡改
 *  - 撤回操作须 stepUpToken 二次认证
 */
export default function PublicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const publicationId = params.id;

  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [recallReason, setRecallReason] = useState("");
  const [recallToken, setRecallToken] = useState("");

  const detailQuery = usePublicationDetail(publicationId);
  const recallMutation = useRecallPublication();
  const deleteMutation = useDeletePublication();

  const detail: PublicationDetailDto | undefined = detailQuery.data;
  const isLoading = detailQuery.isLoading;
  const error = detailQuery.error;

  // 派生统计
  const checkStats = detail ? computeCheckStats(detail.checks) : null;
  const reviewerStats = detail ? computeReviewerStats(detail.reviewers) : null;
  const signatureStats = detail
    ? computeSignatureStats(detail.signatures)
    : null;
  const operationTimeline = detail
    ? computeOperationStats(detail.operations)
    : [];

  // 是否可撤回（仅 PUBLISHED / READY_TO_PUBLISH / PUBLISHING 可撤回）
  const canRecall =
    detail?.status === "PUBLISHED" ||
    detail?.status === "READY_TO_PUBLISH" ||
    detail?.status === "PUBLISHING";

  // 是否可删除（仅 DRAFT 可删除）
  const canDelete = detail?.status === "DRAFT";

  const handleRecall = async () => {
    if (!detail) return;
    if (recallReason.trim().length < 10) {
      message.warning("撤回原因至少 10 个字符");
      return;
    }
    if (!recallToken) {
      message.warning("请输入 Step-up Token");
      return;
    }
    try {
      await recallMutation.mutateAsync({
        publicationId: detail.id,
        reason: recallReason,
        stepUpToken: recallToken,
      });
      message.success("发布已撤回");
      setRecallModalOpen(false);
      setRecallReason("");
      setRecallToken("");
    } catch {
      // V0：后端未实现时静默失败
      message.error("撤回失败：后端 API 可能未实现（V0 预期）");
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    try {
      await deleteMutation.mutateAsync(detail.id);
      message.success("草稿已删除");
      router.push("/publications");
    } catch {
      message.error("删除失败：后端 API 可能未实现（V0 预期）");
    }
  };

  // ── 加载态 ──
  if (isLoading) {
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/publications")}
          style={{ paddingLeft: 0 }}
        >
          返回发布列表
        </Button>
        <Card size="small">
          <Spin tip="加载发布详情...">
            <div style={{ minHeight: 400 }} />
          </Spin>
        </Card>
      </Space>
    );
  }

  // ── 错误态 ──
  if (error) {
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/publications")}
          style={{ paddingLeft: 0 }}
        >
          返回发布列表
        </Button>
        <Card size="small">
          <Title level={4} style={{ margin: 0 }}>
            <CloudUploadOutlined style={{ marginRight: 8 }} />
            发布详情
          </Title>
        </Card>
        <DataErrorAlert
          error={error}
          context="发布详情"
          variant="inline"
          onRetry={() => void detailQuery.refetch()}
          retryLabel="重试"
        />
      </Space>
    );
  }

  // ── 空态（API 未实现） ──
  if (!detail) {
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/publications")}
          style={{ paddingLeft: 0 }}
        >
          返回发布列表
        </Button>
        <Card size="small">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">未找到发布记录</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  后端 Publication API 待 V1 实现，发布详情不可用
                </Text>
              </Space>
            }
            style={{ padding: 48 }}
          >
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => void detailQuery.refetch()}
            >
              重新加载
            </Button>
          </Empty>
        </Card>
      </Space>
    );
  }

  // ── Tab 项定义 ──
  const tabItems = [
    {
      key: "overview",
      label: "概览",
      children: <OverviewTab detail={detail} />,
    },
    {
      key: "checks",
      label: (
        <Space size={4}>
          <span>完整性检查</span>
          {checkStats && (
            <Tag
              color={checkStats.blocking > 0 ? "error" : "success"}
              style={{ marginLeft: 4 }}
            >
              {checkStats.total}
            </Tag>
          )}
        </Space>
      ),
      children: <ChecksTab checks={detail.checks} />,
    },
    {
      key: "evidence",
      label: (
        <Space size={4}>
          <span>证据</span>
          <Tag color="blue">{detail.evidence.length}</Tag>
        </Space>
      ),
      children: <EvidenceTab evidence={detail.evidence} />,
    },
    {
      key: "reviewers",
      label: (
        <Space size={4}>
          <span>复核决策</span>
          {reviewerStats && (
            <Tag
              color={reviewerStats.pending > 0 ? "processing" : "success"}
              style={{ marginLeft: 4 }}
            >
              {reviewerStats.total}
            </Tag>
          )}
        </Space>
      ),
      children: <ReviewersTab reviewers={detail.reviewers} />,
    },
    {
      key: "signatures",
      label: (
        <Space size={4}>
          <span>签名</span>
          {signatureStats && (
            <Tag
              color={
                signatureStats.signed >= signatureStats.total &&
                signatureStats.total > 0
                  ? "success"
                  : "warning"
              }
              style={{ marginLeft: 4 }}
            >
              {signatureStats.signed} / {signatureStats.total}
            </Tag>
          )}
        </Space>
      ),
      children: <SignaturesTab signatures={detail.signatures} />,
    },
    {
      key: "recipients",
      label: (
        <Space size={4}>
          <span>收件人</span>
          <Tag color="blue">{detail.recipients.length}</Tag>
        </Space>
      ),
      children: <RecipientsTab recipients={detail.recipients} />,
    },
    {
      key: "operations",
      label: "操作阶段",
      children: (
        <OperationsTab
          operations={detail.operations}
          timeline={operationTimeline}
        />
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
          onClick={() => router.push("/publications")}
          style={{ paddingLeft: 0 }}
        >
          返回发布列表
        </Button>
        <Space>
          <Tooltip
            title={
              !canRecall
                ? "当前状态不支持撤回（仅 PUBLISHED / READY_TO_PUBLISH / PUBLISHING 可撤回）"
                : "撤回发布需 Step-up 二次认证"
            }
          >
            <Button
              danger
              icon={<RollbackOutlined />}
              disabled={!canRecall}
              onClick={() => setRecallModalOpen(true)}
            >
              撤回发布
            </Button>
          </Tooltip>
          <Tooltip
            title={!canDelete ? "仅 DRAFT 草稿可删除" : "删除草稿不可恢复"}
          >
            <Popconfirm
              title="确认删除草稿"
              description="此操作不可恢复，请确认。"
              onConfirm={() => void handleDelete()}
              disabled={!canDelete}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!canDelete}
                loading={deleteMutation.isPending}
              >
                删除草稿
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      </div>

      {/* 发布头部 */}
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Space align="center" size={8}>
            <Title level={4} style={{ margin: 0 }}>
              <CloudUploadOutlined style={{ marginRight: 8 }} />
              {detail.title}
            </Title>
            <Tag color={PUBLICATION_STATUS_COLOR[detail.status]}>
              {PUBLICATION_STATUS_LABEL[detail.status]}
            </Tag>
          </Space>
          <Space size="large">
            <Text type="secondary">
              编号：<Text code>{detail.code}</Text>
            </Text>
            <Text type="secondary">
              发布人：{detail.publisherName ?? detail.publisherId}
            </Text>
            <Text type="secondary">
              创建时间：{new Date(detail.createdAt).toLocaleString()}
            </Text>
            {detail.publishedAt && (
              <Text type="secondary">
                发布时间：{new Date(detail.publishedAt).toLocaleString()}
              </Text>
            )}
          </Space>
        </Space>
      </Card>

      {/* V0 限制提示 */}
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="发布管理 API 待 V1 实现"
        description="后端 Publication / Submission / Signature / Recipient API 尚未实现。下方详情实时查询后端；返回 404/501 时显示空状态，不伪造数据。撤回/删除操作尝试调用 API，失败时显示提示。"
      />

      {/* AI 安全红线提示 */}
      <Alert
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="AI 安全红线"
        description="所有发布必须由注册建筑师 / 工程师签章。签名后对象锁定，不可篡改。AI 输出不替代专业审签和监管审批。"
      />

      {/* 统计卡 */}
      <Card size="small" bodyStyle={{ padding: "8px 12px" }}>
        <Space size="large" wrap>
          {checkStats && (
            <Space size={4}>
              <Tag color={checkStats.blocking === 0 ? "success" : "error"}>
                阻断: {checkStats.blocking}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {checkStats.blocking === 0 ? "已全部解决" : "需先关闭阻断项"}
              </Text>
            </Space>
          )}
          {checkStats && (
            <Space size={4}>
              <Tag color={checkStats.warning === 0 ? "success" : "warning"}>
                警告: {checkStats.warning}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {checkStats.warning === 0 ? "无警告" : "需确认处置"}
              </Text>
            </Space>
          )}
          {reviewerStats && (
            <Space size={4}>
              <Tag
                color={reviewerStats.pending === 0 ? "success" : "processing"}
              >
                待评审: {reviewerStats.pending}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {reviewerStats.total} 项
              </Text>
            </Space>
          )}
          {signatureStats && signatureStats.total > 0 && (
            <Space size={4}>
              <Tag
                color={
                  signatureStats.signed >= signatureStats.total
                    ? "success"
                    : "warning"
                }
              >
                签名: {signatureStats.signed} / {signatureStats.total}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {signatureStats.signed >= signatureStats.total
                  ? "已全部签名"
                  : `还需 ${signatureStats.total - signatureStats.signed} 个签名`}
              </Text>
            </Space>
          )}
        </Space>
      </Card>

      {/* Tab 详情区 */}
      <Card size="small">
        <Tabs items={tabItems} defaultActiveKey="overview" size="small" />
      </Card>

      {/* 撤回发布 Modal */}
      <Modal
        title="撤回发布"
        open={recallModalOpen}
        onCancel={() => setRecallModalOpen(false)}
        onOk={() => void handleRecall()}
        okText="确认撤回"
        cancelText="取消"
        okButtonProps={{
          danger: true,
          loading: recallMutation.isPending,
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="此操作不可逆"
            description="撤回发布后，已通知的收件人将收到撤回通知。已签名的对象将进入已撤回状态，不可重新发布。"
          />
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="发布编号">
              <Text code>{detail.code}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="发布标题">
              {detail.title}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={PUBLICATION_STATUS_COLOR[detail.status]}>
                {PUBLICATION_STATUS_LABEL[detail.status]}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              撤回原因（≥10 字符）：
            </Text>
            <Input.TextArea
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="如：发现 Baseline 存在错误，需要重新生成后再发布。"
              rows={3}
              maxLength={1024}
              style={{ marginTop: 4 }}
            />
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
              {recallReason.length} / 1024 字符
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Step-up Token（必填）：
            </Text>
            <Input.Password
              value={recallToken}
              onChange={(e) => setRecallToken(e.target.value)}
              placeholder="请输入二次认证 Token"
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}

// ── 概览 Tab ──

function OverviewTab({ detail }: { detail: PublicationDetailDto }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions size="small" column={2} bordered title="基本信息">
        <Descriptions.Item label="发布编号">
          <Text code copyable>
            {detail.code}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="发布标题">{detail.title}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={PUBLICATION_STATUS_COLOR[detail.status]}>
            {PUBLICATION_STATUS_LABEL[detail.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="发布人">
          {detail.publisherName ?? detail.publisherId}
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
        {detail.publishedAt && (
          <Descriptions.Item label="发布时间" span={2}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(detail.publishedAt).toLocaleString()}
            </Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Descriptions
        size="small"
        column={1}
        bordered
        title="Baseline（精确版本）"
      >
        <Descriptions.Item label="Baseline ID">
          <Text code>{detail.baselineId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Baseline Hash">
          <Tooltip title={detail.baselineHash}>
            <Text code style={{ fontSize: 11 }}>
              {detail.baselineHash.length > 60
                ? `${detail.baselineHash.slice(0, 60)}...`
                : detail.baselineHash}
            </Text>
          </Tooltip>
        </Descriptions.Item>
        {detail.baseline && (
          <>
            <Descriptions.Item label="Baseline 标题">
              {detail.baseline.title}
            </Descriptions.Item>
            <Descriptions.Item label="冻结时间">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {detail.baseline.frozenAt
                  ? new Date(detail.baseline.frozenAt).toLocaleString()
                  : "—"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="冻结状态">
              {detail.baseline.isFrozen ? (
                <Tag color="success">已冻结</Tag>
              ) : (
                <Tag color="warning">未冻结</Tag>
              )}
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      <Descriptions
        size="small"
        column={2}
        bordered
        title="发布清单（Manifest）"
      >
        <Descriptions.Item label="留存期">
          {detail.manifest.retentionDays >= 365
            ? `${(detail.manifest.retentionDays / 365).toFixed(0)} 年`
            : `${detail.manifest.retentionDays} 天`}
        </Descriptions.Item>
        <Descriptions.Item label="签名要求">
          <Space wrap>
            {detail.manifest.requiredSignatures.map((role: SignatureRole) => (
              <Tag key={role} color="blue">
                {SIGNATURE_ROLE_LABEL[role]}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="对象锁定">
          {detail.manifest.enableObjectLock ? (
            <Tag color="success">启用（不可篡改）</Tag>
          ) : (
            <Tag color="default">未启用</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="归档包">
          {detail.manifest.generateArchivePackage ? (
            <Tag color="blue">自动生成</Tag>
          ) : (
            <Tag color="default">不生成</Tag>
          )}
        </Descriptions.Item>
        {detail.manifest.notes && (
          <Descriptions.Item label="备注" span={2}>
            <Text type="secondary">{detail.manifest.notes}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      {detail.stepUpReason && (
        <Descriptions size="small" column={1} bordered title="Step-up 提交原因">
          <Descriptions.Item label="提交理由">
            <Paragraph style={{ margin: 0 }}>{detail.stepUpReason}</Paragraph>
          </Descriptions.Item>
        </Descriptions>
      )}

      <Alert
        type="info"
        showIcon
        message="AI 辅助声明"
        description={
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>
              AI 辅助标记：
              {detail.isAiAssisted ? "是" : "否（发布不依赖 AI 输出）"}
            </Text>
            <Text style={{ fontSize: 12 }}>
              需人工复核：
              {detail.requiresHumanReview ? "是（必须人工签章）" : "否"}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              AI 不替代注册建筑师 / 工程师的专业审签和监管审批
            </Text>
          </Space>
        }
      />
    </Space>
  );
}

// ── 完整性检查 Tab ──

function ChecksTab({ checks }: { checks: ReadinessCheckDto[] }) {
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
      ellipsis: true,
      render: (detail: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {detail}
        </Text>
      ),
    },
    {
      title: "需确认",
      key: "requiresAcknowledgment",
      width: 90,
      align: "center",
      render: (_, record) =>
        record.requiresAcknowledgment ? (
          record.acknowledgedBy ? (
            <Tag color="success">已确认</Tag>
          ) : (
            <Tag color="warning">待确认</Tag>
          )
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "确认人",
      dataIndex: "acknowledgedBy",
      key: "acknowledgedBy",
      width: 140,
      render: (val?: string | null) =>
        val ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {val}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  if (checks.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无完整性检查（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <Table<ReadinessCheckDto>
      rowKey="id"
      columns={columns}
      dataSource={checks}
      pagination={false}
      size="small"
      scroll={{ x: 800 }}
    />
  );
}

// ── 证据 Tab ──

function EvidenceTab({ evidence }: { evidence: EvidenceItemDto[] }) {
  if (evidence.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无关联证据（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
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
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  引用 ID：{item.referenceId}
                </Text>
                {item.referenceUrl && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    引用 URL：
                    <a
                      href={item.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.referenceUrl}
                    </a>
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  创建时间：{new Date(item.createdAt).toLocaleString()}
                </Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );
}

// ── 复核决策 Tab ──

function ReviewersTab({ reviewers }: { reviewers: ReviewerDecisionDto[] }) {
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
    {
      title: "Conditional 责任人",
      dataIndex: "conditionalOwner",
      key: "conditionalOwner",
      width: 140,
      render: (val?: string | null) =>
        val ? (
          <Text type="secondary">{val}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Conditional 期限",
      dataIndex: "conditionalDueAt",
      key: "conditionalDueAt",
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
      title: "决策时间",
      dataIndex: "decidedAt",
      key: "decidedAt",
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
  ];

  if (reviewers.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无复核矩阵（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <Table<ReviewerDecisionDto>
      rowKey="id"
      columns={columns}
      dataSource={reviewers}
      pagination={false}
      size="small"
      scroll={{ x: 1100 }}
    />
  );
}

// ── 签名 Tab ──

function SignaturesTab({ signatures }: { signatures: SignatureDto[] }) {
  const columns: ColumnsType<SignatureDto> = [
    {
      title: "签名角色",
      dataIndex: "role",
      key: "role",
      width: 180,
      render: (role: SignatureRole) => (
        <Tag color="blue">{SIGNATURE_ROLE_LABEL[role]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: SignatureStatus) => (
        <Tag color={SIGNATURE_STATUS_COLOR[status]}>
          {SIGNATURE_STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: "签名者",
      dataIndex: "signerName",
      key: "signerName",
      width: 140,
      render: (val?: string | null) =>
        val ? <Text>{val}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "签名时间",
      dataIndex: "signedAt",
      key: "signedAt",
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
      title: "签名 Hash",
      dataIndex: "signatureHash",
      key: "signatureHash",
      ellipsis: true,
      render: (val?: string | null) =>
        val ? (
          <Tooltip title={val}>
            <Text code style={{ fontSize: 11 }}>
              {val.length > 30 ? `${val.slice(0, 30)}...` : val}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "证书 DN",
      dataIndex: "certificateDn",
      key: "certificateDn",
      ellipsis: true,
      render: (val?: string | null) =>
        val ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {val}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "拒签原因",
      dataIndex: "rejectReason",
      key: "rejectReason",
      ellipsis: true,
      render: (val?: string | null) =>
        val ? (
          <Text type="danger" style={{ fontSize: 12 }}>
            {val}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  if (signatures.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无签名记录（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <Table<SignatureDto>
      rowKey="id"
      columns={columns}
      dataSource={signatures}
      pagination={false}
      size="small"
      scroll={{ x: 1100 }}
    />
  );
}

// ── 收件人 Tab ──

function RecipientsTab({ recipients }: { recipients: RecipientDto[] }) {
  const columns: ColumnsType<RecipientDto> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (type: RecipientType) => (
        <Tag color="blue">{RECIPIENT_TYPE_LABEL[type]}</Tag>
      ),
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (val?: string | null) =>
        val ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {val}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "通知状态",
      dataIndex: "notified",
      key: "notified",
      width: 120,
      align: "center",
      render: (notified: boolean, record) =>
        notified ? (
          <Tooltip
            title={
              record.notifiedAt
                ? `通知时间：${new Date(record.notifiedAt).toLocaleString()}`
                : "已通知"
            }
          >
            <Tag color="success">已通知</Tag>
          </Tooltip>
        ) : (
          <Tag color="default">未通知</Tag>
        ),
    },
    {
      title: "下载链接",
      dataIndex: "downloadUrl",
      key: "downloadUrl",
      ellipsis: true,
      render: (val?: string | null) =>
        val ? (
          <a href={val} target="_blank" rel="noreferrer">
            下载
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "链接有效期",
      dataIndex: "linkExpiryDays",
      key: "linkExpiryDays",
      width: 110,
      align: "center",
      render: (val?: number | null) =>
        val ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {val} 天
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  if (recipients.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无收件人（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <Table<RecipientDto>
      rowKey="id"
      columns={columns}
      dataSource={recipients}
      pagination={false}
      size="small"
      scroll={{ x: 900 }}
    />
  );
}

// ── 操作阶段 Tab ──

function OperationsTab({
  operations,
  timeline,
}: {
  operations: PublicationOperationPhaseDto[];
  timeline: ReturnType<typeof computeOperationStats>;
}) {
  if (operations.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无操作阶段记录（V0：后端未实现）"
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="发布 Operation 流程"
        description="Sealing（密封）→ Signing（签名收集）→ Object Lock（对象锁定）→ Notification（通知收件人）。所有阶段完成后发布视为成功。"
      />

      <Timeline
        items={timeline.map((item) => {
          const phaseLabel = OPERATION_PHASE_LABEL[item.phase];
          const statusLabel = OPERATION_PHASE_STATUS_LABEL[item.status];
          const statusColor = OPERATION_PHASE_STATUS_COLOR[item.status];
          return {
            color:
              item.status === "COMPLETED"
                ? "green"
                : item.status === "IN_PROGRESS"
                  ? "blue"
                  : item.status === "FAILED"
                    ? "red"
                    : "gray",
            children: (
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space>
                  <Text strong>{phaseLabel}</Text>
                  <Tag color={statusColor}>{statusLabel}</Tag>
                </Space>
                {item.startedAt && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    开始：{new Date(item.startedAt).toLocaleString()}
                  </Text>
                )}
                {item.completedAt && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    完成：{new Date(item.completedAt).toLocaleString()}
                  </Text>
                )}
                {item.failureReason && (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    失败原因：{item.failureReason}
                  </Text>
                )}
                {item.retryCount > 0 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    重试次数：{item.retryCount}
                  </Text>
                )}
              </Space>
            ),
          };
        })}
      />
    </Space>
  );
}
