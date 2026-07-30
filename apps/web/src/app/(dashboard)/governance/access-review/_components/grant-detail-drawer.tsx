"use client";

import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  UserOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  StopOutlined,
  CompressOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { GovernanceAccessGrant } from "@design-platform/shared";

const { Text, Paragraph } = Typography;

interface AccessGrantDetailDrawerProps {
  grant: GovernanceAccessGrant | null;
  open: boolean;
  onClose: () => void;
  onRevoke: (grant: GovernanceAccessGrant) => void;
  onShorten: (grant: GovernanceAccessGrant) => void;
}

const TYPE_LABEL: Record<GovernanceAccessGrant["type"], string> = {
  member: "成员",
  external: "外部",
  service: "服务",
  breakglass: "Break-Glass",
};

const RISK_LABEL: Record<GovernanceAccessGrant["riskLevel"], string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "严重",
};

const STATUS_LABEL: Record<GovernanceAccessGrant["status"], string> = {
  active: "生效中",
  pending_review: "待审",
  shortened: "已缩短",
  revoked: "已撤销",
  expired: "已过期",
};

/**
 * Grant 详情抽屉（D37.17）
 *
 * 显示：
 *  - 基本信息（Principal/Resource/Permission）
 *  - 时间线（颁发/使用/到期）
 *  - Owner 与审批链
 *  - 传播水位（撤权影响的下游 Grant）
 *  - 法律保留提示
 *  - 操作按钮（缩短/撤销）
 */
export function AccessGrantDetailDrawer({
  grant,
  open,
  onClose,
  onRevoke,
  onShorten,
}: AccessGrantDetailDrawerProps) {
  if (!grant) {
    return (
      <Drawer
        title="Grant 详情"
        open={open}
        onClose={onClose}
        width={520}
        destroyOnClose
      >
        <Empty description="未选择 Grant" />
      </Drawer>
    );
  }

  const canRevoke =
    grant.status === "active" ||
    grant.status === "pending_review" ||
    grant.status === "shortened";
  const canShorten =
    grant.status === "active" || grant.status === "pending_review";

  return (
    <Drawer
      title={
        <Space>
          <KeyOutlined />
          <Text>Grant 详情</Text>
          <Text code style={{ fontSize: 12 }}>
            {grant.id}
          </Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      extra={
        <Space>
          <Button
            icon={<CompressOutlined />}
            disabled={!canShorten}
            onClick={() => onShorten(grant)}
          >
            缩短至 24h
          </Button>
          <Button
            danger
            icon={<StopOutlined />}
            disabled={!canRevoke}
            onClick={() => onRevoke(grant)}
          >
            撤销
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* 状态摘要 */}
        <Space size="middle">
          <Tag color="red">{TYPE_LABEL[grant.type]}</Tag>
          <Tag color="orange">风险：{RISK_LABEL[grant.riskLevel]}</Tag>
          <Tag color="blue">{STATUS_LABEL[grant.status]}</Tag>
          {grant.requiresStepUp && (
            <Tag color="purple" icon={<ExclamationCircleOutlined />}>
              需 Step-up
            </Tag>
          )}
          {grant.hasLegalHold && (
            <Tag color="magenta" icon={<ExclamationCircleOutlined />}>
              法律保留
            </Tag>
          )}
        </Space>

        {/* 基本信息 */}
        <Descriptions column={1} size="small" title="Principal 与资源" bordered>
          <Descriptions.Item label="Principal">
            <Space direction="vertical" size={0}>
              <Space>
                <UserOutlined />
                <Text strong>{grant.principalName}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {grant.principalEmail}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="资源">{grant.resource}</Descriptions.Item>
          <Descriptions.Item label="权限">
            <Text code>{grant.permission}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="颁发原因">{grant.reason}</Descriptions.Item>
        </Descriptions>

        {/* 时间线 */}
        <Descriptions column={1} size="small" title="时间线" bordered>
          <Descriptions.Item label="颁发者">
            <Space>
              <TeamOutlined />
              <Text>{grant.grantedBy}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="颁发时间">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(grant.grantedAt).toLocaleString("zh-CN")}
          </Descriptions.Item>
          <Descriptions.Item label="到期时间">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(grant.expiresAt).toLocaleString("zh-CN")}
          </Descriptions.Item>
          <Descriptions.Item label="最后使用">
            {grant.lastUsedAt ? (
              <>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {new Date(grant.lastUsedAt).toLocaleString("zh-CN")}
              </>
            ) : (
              <Text type="secondary">从未使用</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* Owner */}
        <Descriptions
          column={1}
          size="small"
          title="Owner（负责审批/撤销）"
          bordered
        >
          <Descriptions.Item label="Owner">
            <Space direction="vertical" size={0}>
              <Text>{grant.owner}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {grant.ownerEmail}
              </Text>
            </Space>
          </Descriptions.Item>
        </Descriptions>

        {/* 传播水位 */}
        <Descriptions
          column={1}
          size="small"
          title="撤权传播水位（依赖拓扑）"
          bordered
        >
          <Descriptions.Item label="下游 Grant">
            {grant.propagationDependents &&
            grant.propagationDependents.length > 0 ? (
              <Space wrap>
                {grant.propagationDependents.map((id) => (
                  <Tag key={id} color="orange">
                    {id}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">无下游依赖</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="传播策略">
            <Text type="secondary" style={{ fontSize: 12 }}>
              撤权将按拓扑异步传播；下游 Grant
              在水位到达前保持生效，到达后自动失效。
            </Text>
          </Descriptions.Item>
        </Descriptions>

        {/* 法律保留提示 */}
        {grant.hasLegalHold && (
          <Alert
            type="warning"
            showIcon
            message="涉及法律保留"
            description="此 Grant 关联资源存在法律保留，撤销后须保留审计日志与证据包至少 7 年，期间不可彻底删除。"
          />
        )}

        {/* Break-Glass 提示 */}
        {grant.type === "breakglass" && (
          <Alert
            type="error"
            showIcon
            message="Break-Glass 紧急访问"
            description={
              <Space direction="vertical" size={2}>
                <Text>· Break-Glass 访问全程录像，操作日志单独归档。</Text>
                <Text>· 24 小时内必须由审计员复核所有操作。</Text>
                <Text>· 到期自动失效，禁止续期（必须重新申请）。</Text>
              </Space>
            }
          />
        )}

        {/* 使用历史时间线（Mock） */}
        <div>
          <Paragraph
            type="secondary"
            style={{ marginBottom: 12, fontSize: 13 }}
          >
            最近使用记录（V0 Mock，V1 从 Audit Log 拉取）
          </Paragraph>
          <Timeline
            items={[
              {
                color: "green",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>读取文档</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      2026-07-28 09:32 · IP 10.0.1.42 · UA Chrome 130
                    </Text>
                  </Space>
                ),
              },
              {
                color: "blue",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>下载版本 ver-089</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      2026-07-27 16:20 · IP 10.0.1.42 · UA Chrome 130
                    </Text>
                  </Space>
                ),
              },
              {
                color: "gray",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>登录</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      2026-07-25 09:00 · IP 10.0.1.42 · 首次使用
                    </Text>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Space>
    </Drawer>
  );
}
