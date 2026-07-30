"use client";

import {
  Alert,
  Button,
  Empty,
  List,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CommentOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  IssueCommentDto,
  ViewpointDto,
  WaiverDto,
} from "@design-platform/shared";
import {
  useComments,
  useViewpoints,
  useWaivers,
} from "@/hooks/use-coordination";

const { Text, Paragraph } = Typography;

/**
 * P07 协调工作台右侧 IssueContextRail
 * 对齐 D37.11 §布局「Issue Context rail」 + §正常状态「Finding→Cluster→Issue 关系」
 *
 * 功能：
 *  - 展示 Issue 的 Viewpoint / Comment / Waiver 三个上下文区段
 *  - Viewpoint：BCF 视点列表（camera/selection/snapshot），点击可定位 Viewer
 *  - Comment：评论时间线（含状态变更/指派/验证记录），支持 ETag 冲突保留草稿
 *  - Waiver：豁免记录（范围/期限/批准人），过期自动回待审
 *
 * V0：后端 Coordination API 未就位时显示空状态
 */

interface IssueContextRailProps {
  /** 当前选中的 Issue ID（null 时显示占位） */
  issueId: string | null;
  /** 触发创建评论回调 */
  onCreateComment?: (issueId: string) => void;
  /** 触发创建豁免回调 */
  onCreateWaiver?: (issueId: string) => void;
  /** 触发创建视点回调 */
  onCreateViewpoint?: (issueId: string) => void;
  /** 触发定位 Viewer */
  onViewpointSelect?: (viewpoint: ViewpointDto) => void;
}

export function IssueContextRail({
  issueId,
  onCreateComment,
  onCreateWaiver,
  onCreateViewpoint,
  onViewpointSelect,
}: IssueContextRailProps) {
  const viewpointsQuery = useViewpoints(issueId);
  const commentsQuery = useComments(issueId);
  const waiversQuery = useWaivers(issueId);

  // 未选中 Issue 时显示占位
  if (!issueId) {
    return (
      <div style={{ padding: 24, height: "100%" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ fontSize: 12 }}>
              选择 Issue 后
              <br />
              显示上下文信息
            </span>
          }
          style={{ marginTop: 80 }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Issue 上下文
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {issueId.slice(0, 8)}…
        </Text>
      </div>

      {/* 上下文区段 */}
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {/* 区段 1：Viewpoint（视点列表） */}
        <ContextSection
          title="BCF 视点"
          icon={<EnvironmentOutlined />}
          count={viewpointsQuery.data?.length ?? 0}
          loading={viewpointsQuery.isLoading}
          error={viewpointsQuery.error}
          actionLabel="新建视点"
          onAction={() => onCreateViewpoint?.(issueId)}
        >
          {viewpointsQuery.data && viewpointsQuery.data.length > 0 ? (
            <List
              size="small"
              dataSource={viewpointsQuery.data}
              renderItem={(vp) => (
                <List.Item
                  key={vp.id}
                  onClick={() => onViewpointSelect?.(vp)}
                  style={{ cursor: "pointer", padding: "6px 8px" }}
                >
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>
                        {vp.label ?? vp.type}
                      </Text>
                      <Tag style={{ fontSize: 10 }}>{vp.type}</Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      构件 {vp.selection.length} 项 · 创建人 {vp.createdBy}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <EmptySection text="暂无视点" />
          )}
        </ContextSection>

        {/* 区段 2：Comment（评论列表） */}
        <ContextSection
          title="评论"
          icon={<CommentOutlined />}
          count={commentsQuery.data?.length ?? 0}
          loading={commentsQuery.isLoading}
          error={commentsQuery.error}
          actionLabel="新增评论"
          onAction={() => onCreateComment?.(issueId)}
        >
          {commentsQuery.data && commentsQuery.data.length > 0 ? (
            <List
              size="small"
              dataSource={commentsQuery.data}
              renderItem={(c) => (
                <List.Item key={c.id} style={{ padding: "6px 8px" }}>
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 2,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>
                        <UserOutlined /> {c.authorName}
                      </Text>
                      <CommentTypeTag type={c.type} />
                    </div>
                    <Paragraph
                      style={{
                        fontSize: 12,
                        margin: 0,
                        color: "#333",
                      }}
                    >
                      {c.content}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <EmptySection text="暂无评论" />
          )}
        </ContextSection>

        {/* 区段 3：Waiver（豁免列表） */}
        <ContextSection
          title="豁免"
          icon={<SafetyCertificateOutlined />}
          count={waiversQuery.data?.length ?? 0}
          loading={waiversQuery.isLoading}
          error={waiversQuery.error}
          actionLabel="申请豁免"
          onAction={() => onCreateWaiver?.(issueId)}
        >
          {waiversQuery.data && waiversQuery.data.length > 0 ? (
            <List
              size="small"
              dataSource={waiversQuery.data}
              renderItem={(w) => <WaiverListItem key={w.id} waiver={w} />}
            />
          ) : (
            <EmptySection text="暂无豁免" />
          )}
        </ContextSection>
      </div>
    </div>
  );
}

// ── 内部辅助组件 ──

function ContextSection({
  title,
  icon,
  count,
  loading,
  error,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  loading: boolean;
  error: unknown;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  const status = (error as { status?: number })?.status;
  const isNotImplemented = status === 404 || status === 501;

  return (
    <div
      style={{
        marginBottom: 12,
        border: "1px solid #f0f0f0",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          background: "#fafafa",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          {icon} {title} ({count})
        </Text>
        <Button
          type="link"
          size="small"
          style={{ fontSize: 11, padding: 0, height: 20 }}
          onClick={onAction}
          disabled={isNotImplemented}
        >
          {actionLabel}
        </Button>
      </div>
      <div style={{ maxHeight: 200, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            <Spin size="small" />
          </div>
        ) : error ? (
          <Alert
            type={isNotImplemented ? "info" : "error"}
            showIcon
            message={
              isNotImplemented ? `${title} API 待 V1 实现` : `加载${title}失败`
            }
            style={{ margin: 8, fontSize: 11 }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "16px 8px",
        textAlign: "center",
        color: "#999",
        fontSize: 11,
      }}
    >
      {text}
    </div>
  );
}

function CommentTypeTag({ type }: { type: IssueCommentDto["type"] }) {
  const colorMap: Record<IssueCommentDto["type"], string> = {
    COMMENT: "default",
    STATUS_CHANGE: "blue",
    ASSIGNMENT: "purple",
    VERIFICATION: "green",
  };
  const labelMap: Record<IssueCommentDto["type"], string> = {
    COMMENT: "评论",
    STATUS_CHANGE: "状态",
    ASSIGNMENT: "指派",
    VERIFICATION: "验证",
  };
  return (
    <Tag color={colorMap[type]} style={{ fontSize: 10 }}>
      {labelMap[type]}
    </Tag>
  );
}

function WaiverListItem({ waiver }: { waiver: WaiverDto }) {
  const statusColor: Record<WaiverDto["status"], string> = {
    PENDING: "processing",
    APPROVED: "success",
    REJECTED: "error",
    EXPIRED: "warning",
    REVOKED: "default",
  };
  const statusLabel: Record<WaiverDto["status"], string> = {
    PENDING: "待审批",
    APPROVED: "已批准",
    REJECTED: "已拒绝",
    EXPIRED: "已过期",
    REVOKED: "已撤销",
  };

  const isExpired =
    waiver.status === "EXPIRED" ||
    (new Date(waiver.expiresAt).getTime() < Date.now() &&
      waiver.status === "APPROVED");

  return (
    <List.Item style={{ padding: "6px 8px" }}>
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <Tag color={statusColor[waiver.status]} style={{ fontSize: 10 }}>
            {statusLabel[waiver.status]}
          </Tag>
          <Tooltip title={waiver.expiresAt}>
            <Text
              type={isExpired ? "danger" : "secondary"}
              style={{ fontSize: 10 }}
            >
              到期 {new Date(waiver.expiresAt).toLocaleDateString("zh-CN")}
            </Text>
          </Tooltip>
        </div>
        <Paragraph style={{ fontSize: 12, margin: "0 0 4px 0", color: "#333" }}>
          {waiver.scope}
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 11 }}>
          依据：{waiver.justification}
        </Text>
        {waiver.compensatingControl && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            <Tooltip title="补偿控制">
              <SafetyCertificateOutlined />
            </Tooltip>{" "}
            {waiver.compensatingControl}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
          签审角色：{waiver.approvalRole}
          {waiver.approvedBy && ` · 审批人 ${waiver.approvedBy}`}
        </div>
      </div>
    </List.Item>
  );
}
