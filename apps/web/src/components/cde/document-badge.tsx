"use client";

import { Tag, Tooltip } from "antd";
import {
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  LockOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import {
  getDocumentStatusConfig,
  getDocumentVersionStatusConfig,
  isKnownDocumentStatus,
  isKnownDocumentVersionStatus,
  type DocumentStatus,
  type DocumentVersionStatus,
} from "./document-config";

/** 文档状态图标映射 */
const DOCUMENT_STATUS_ICONS: Record<string, ReactNode> = {
  draft: <EditOutlined />,
  checked_out: <SyncOutlined spin />,
  published: <CheckCircleOutlined />,
  superseded: <ClockCircleOutlined />,
  archived: <LockOutlined />,
  unknown: <QuestionCircleOutlined />,
};

/** 文档版本状态图标映射 */
const DOCUMENT_VERSION_STATUS_ICONS: Record<string, ReactNode> = {
  draft: <EditOutlined />,
  published: <CheckCircleOutlined />,
  superseded: <ClockCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
};

interface BadgeProps<T> {
  /** 后端返回的原始值（可能为未知枚举） */
  value: T | string | undefined | null;
}

/**
 * 文档状态标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function DocumentStatusBadge({ value }: BadgeProps<DocumentStatus>) {
  const config = getDocumentStatusConfig(value);
  const isKnown = isKnownDocumentStatus(value);
  const icon = DOCUMENT_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知文档状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}

/**
 * 文档版本状态标签
 *
 * - 已知枚举：显示对应颜色与英文标签 + 图标
 * - 未知枚举/null/undefined：显示"未知"灰色标签，Tooltip 提示原始值
 */
export function DocumentVersionStatusBadge({
  value,
}: BadgeProps<DocumentVersionStatus>) {
  const config = getDocumentVersionStatusConfig(value);
  const isKnown = isKnownDocumentVersionStatus(value);
  const icon = DOCUMENT_VERSION_STATUS_ICONS[config.iconKey];

  if (isKnown || !value) {
    return (
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    );
  }

  return (
    <Tooltip title={`未知版本状态：${value}`}>
      <Tag icon={icon} color={config.color}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}
