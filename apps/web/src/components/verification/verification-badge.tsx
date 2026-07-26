"use client";

import { Tag, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import {
  getRiskConfig,
  getStatusConfig,
  getTypeConfig,
  isKnownRiskLevel,
  isKnownStatus,
  isKnownType,
  type RiskLevel,
  type VerificationStatus,
  type VerificationType,
} from "./verification-config";

/**
 * 状态图标映射
 */
const STATUS_ICONS: Record<string, ReactNode> = {
  pending: <QuestionCircleOutlined />,
  passed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  waived: <ExclamationCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

interface BadgeProps<T> {
  /** 后端返回的原始值（可能为未知枚举） */
  value: T | string | undefined | null;
}

/**
 * 风险等级标签
 *
 * - 已知枚举：显示对应颜色与中文标签
 * - 未知枚举/null/undefined：显示"未评估"灰色标签，Tooltip 提示原始值
 */
export function RiskLevelBadge({ value }: BadgeProps<RiskLevel>) {
  const config = getRiskConfig(value);
  const isKnown = isKnownRiskLevel(value);

  if (isKnown || !value) {
    return <Tag color={config.color}>{config.label}</Tag>;
  }

  // 未知枚举值：Tooltip 显示原始值便于排查
  return (
    <Tooltip title={`未知风险等级：${value}`}>
      <Tag color={config.color}>{config.label}</Tag>
    </Tooltip>
  );
}

/**
 * 验证状态标签
 */
export function VerificationStatusBadge({
  value,
}: BadgeProps<VerificationStatus>) {
  const config = getStatusConfig(value);
  const isKnown = isKnownStatus(value);
  const icon = STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag color={config.color} icon={icon}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知状态：${value}`}>
      <Tag color={config.color} icon={icon}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 验证类型标签
 */
export function VerificationTypeBadge({ value }: BadgeProps<VerificationType>) {
  const config = getTypeConfig(value);
  const isKnown = isKnownType(value);

  if (isKnown || !value) {
    return <Tag color={config.color}>{config.label}</Tag>;
  }

  return (
    <Tooltip title={`未知验证类型：${value}`}>
      <Tag color={config.color}>{config.label}</Tag>
    </Tooltip>
  );
}
