"use client";

import { useState } from "react";
import {
  Alert,
  Descriptions,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  StopOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import type { GovernanceAccessGrant } from "@design-platform/shared";

const { Text } = Typography;

interface RevokeGrantModalProps {
  grant: GovernanceAccessGrant | null;
  onCancel: () => void;
  onConfirm: (grant: GovernanceAccessGrant) => void;
}

const CONFIRM_PHRASE = "REVOKE";

/**
 * 撤销 Grant Modal（D37.17 危险动作）
 *
 * 包含：
 *  - 影响预览（Principal/资源/下游 Grant/法律保留）
 *  - 不可逆性提示
 *  - 替代方案（缩短至 24h 而非彻底撤销）
 *  - Step-up 重新认证（V0：仅输入确认短语，V1 接入实际认证）
 *  - 审计引用提示
 */
export function RevokeGrantModal({
  grant,
  onCancel,
  onConfirm,
}: RevokeGrantModalProps) {
  const [confirmText, setConfirmText] = useState("");

  if (!grant) return null;

  const handleClose = () => {
    setConfirmText("");
    onCancel();
  };

  const handleConfirm = () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setConfirmText("");
    onConfirm(grant);
  };

  const downstreamCount = grant.propagationDependents?.length ?? 0;

  return (
    <Modal
      title={
        <span style={{ color: "#cf1322" }}>
          <StopOutlined style={{ marginRight: 8 }} />
          撤销 Grant {grant.id}
        </span>
      }
      open={!!grant}
      onCancel={handleClose}
      onOk={handleConfirm}
      okText="确认撤销"
      okType="danger"
      cancelText="取消"
      okButtonProps={{ disabled: confirmText !== CONFIRM_PHRASE }}
      width={560}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="error"
          showIcon
          message="不可逆操作"
          description="撤销后该 Grant 立即失效，使用该 Grant 的所有会话和 API 调用将在数秒内被拒绝。"
        />

        {/* 影响预览 */}
        <Descriptions column={1} size="small" title="影响预览" bordered>
          <Descriptions.Item label="Principal">
            <Space>
              <KeyOutlined />
              <Text strong>{grant.principalName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {grant.principalEmail}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="资源">
            <Text style={{ fontSize: 12 }}>{grant.resource}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="权限">
            <Text code>{grant.permission}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="下游 Grant">
            {downstreamCount > 0 ? (
              <Tag color="orange">
                {downstreamCount} 个下游 Grant 将异步失效
              </Tag>
            ) : (
              <Tag color="green">无下游依赖</Tag>
            )}
          </Descriptions.Item>
          {grant.hasLegalHold && (
            <Descriptions.Item label="法律保留">
              <Tag color="magenta">涉及法律保留</Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                审计日志与证据包保留 ≥ 7 年
              </Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="审计">
            <Text type="secondary" style={{ fontSize: 12 }}>
              操作将记录到 Audit Log，含
              actor/timestamp/affectedResources/propagationWatermark
            </Text>
          </Descriptions.Item>
        </Descriptions>

        {/* 替代方案 */}
        <Alert
          type="info"
          showIcon
          message="替代方案"
          description={
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text>
                · 如仅需临时限制，建议在列表&quot;缩短&quot;将到期时间缩短至
                24h，避免影响正在进行的任务。
              </Text>
              <Text>
                · 如怀疑 Token 泄露而非 Grant 本身问题，建议改在 Settings → API
                Tokens 撤销对应 Token。
              </Text>
              <Text>· Break-Glass 类型 Grant 撤销后须启动事后复核流程。</Text>
            </Space>
          }
        />

        {/* Step-up 认证 */}
        {grant.requiresStepUp && (
          <Alert
            type="warning"
            showIcon
            message={
              <Space>
                <WarningOutlined />
                <Text strong>Step-up 重新认证</Text>
              </Space>
            }
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>
                  该 Grant 风险等级为 {grant.riskLevel}，撤销前需 Step-up
                  重新认证身份。
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  V0 阶段以确认短语代替；V1 接入 IAM 后将走
                  MFA/密码重新认证流程。
                </Text>
              </Space>
            }
          />
        )}

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请输入 <Text code>{CONFIRM_PHRASE}</Text> 以确认撤销：
          </Text>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            style={{ marginTop: 4 }}
            aria-label="撤销确认短语"
            prefix={<ExclamationCircleOutlined style={{ color: "#cf1322" }} />}
          />
        </div>
      </Space>
    </Modal>
  );
}
