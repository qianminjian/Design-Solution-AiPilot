"use client";

import { Alert, Descriptions, Space, Tag, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type {
  GuardrailDto,
  GuardrailStatus,
  GuardrailType,
} from "@design-platform/shared";
import {
  GUARDRAIL_STATUS_COLOR,
  GUARDRAIL_STATUS_LABEL,
} from "@/hooks/use-ai-review";

const { Text, Paragraph } = Typography;

/**
 * P09 中栏：Guardrail Banner
 * 对齐 @design/D37-关键界面-交互状态.md §D37.13 §布局「护栏」
 *
 * 功能：
 *  - 展示护栏检查结果（PASSED/WARNING/BLOCKED）
 *  - 触发的规则列表
 *  - 处置建议（如"修改输入后重试" / "切换到更安全的能力"）
 *  - 详细日志（脱敏后）
 *
 * 安全红线：
 *  - BLOCKED 护栏阻断下游使用，Run 不允许 Accept
 *  - WARNING 允许通过但记录，需进入人工复核
 */

const GUARDRAIL_TYPE_LABEL: Record<GuardrailType, string> = {
  INPUT: "输入护栏",
  OUTPUT: "输出护栏",
};

function getAlertType(
  status: GuardrailStatus,
): "success" | "warning" | "error" {
  switch (status) {
    case "PASSED":
      return "success";
    case "WARNING":
      return "warning";
    case "BLOCKED":
      return "error";
  }
}

function getAlertIcon(status: GuardrailStatus) {
  switch (status) {
    case "PASSED":
      return <CheckCircleOutlined />;
    case "WARNING":
      return <WarningOutlined />;
    case "BLOCKED":
      return <StopOutlined />;
  }
}

export interface GuardrailBannerProps {
  /** 护栏 DTO */
  guardrail: GuardrailDto;
}

export function GuardrailBanner({ guardrail }: GuardrailBannerProps) {
  const alertType = getAlertType(guardrail.status);
  const alertIcon = getAlertIcon(guardrail.status);
  const isBlocked = guardrail.status === "BLOCKED";
  const isWarning = guardrail.status === "WARNING";

  return (
    <Alert
      type={alertType}
      showIcon
      icon={alertIcon}
      style={{ padding: 12 }}
      message={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Space size={6}>
            <SafetyCertificateOutlined />
            <Text strong style={{ fontSize: 13 }}>
              {guardrail.name}
            </Text>
            <Tag style={{ fontSize: 10 }}>
              {GUARDRAIL_TYPE_LABEL[guardrail.type]}
            </Tag>
          </Space>
          <Tag
            color={GUARDRAIL_STATUS_COLOR[guardrail.status]}
            style={{ fontSize: 10 }}
          >
            {GUARDRAIL_STATUS_LABEL[guardrail.status]}
          </Tag>
        </div>
      }
      description={
        <div>
          {/* 触发的规则 */}
          {guardrail.triggeredRules && guardrail.triggeredRules.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                触发规则：
              </Text>
              <Space size={4} wrap style={{ marginLeft: 4 }}>
                {guardrail.triggeredRules.map((rule) => (
                  <Tooltip key={rule} title={rule}>
                    <Tag color="orange" style={{ fontSize: 10 }}>
                      {rule.length > 24 ? `${rule.slice(0, 24)}...` : rule}
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            </div>
          )}

          {/* 原因 */}
          {guardrail.reason && (
            <Paragraph
              style={{
                fontSize: 11,
                margin: "4px 0 0",
                color: "#666",
              }}
            >
              <ExclamationCircleOutlined /> {guardrail.reason}
            </Paragraph>
          )}

          {/* 详细信息 */}
          {guardrail.details && Object.keys(guardrail.details).length > 0 && (
            <Descriptions
              size="small"
              column={1}
              style={{ marginTop: 8 }}
              labelStyle={{ fontSize: 10, color: "#999", width: 100 }}
              contentStyle={{ fontSize: 11 }}
              items={Object.entries(guardrail.details).map(([k, v]) => ({
                key: k,
                label: k,
                children: (
                  <Text code style={{ fontSize: 10 }}>
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </Text>
                ),
              }))}
            />
          )}

          {/* 处置建议 */}
          {guardrail.remediation && (
            <Alert
              type="info"
              showIcon={false}
              style={{
                marginTop: 8,
                padding: "4px 8px",
                fontSize: 11,
                background: "#e6f4ff",
                border: "1px solid #91caff",
              }}
              message={
                <span style={{ fontSize: 11 }}>
                  <Text strong>处置建议：</Text>
                  {guardrail.remediation}
                </span>
              }
            />
          )}

          {/* 阻断提示 */}
          {isBlocked && (
            <Alert
              type="error"
              showIcon
              icon={<StopOutlined />}
              style={{
                marginTop: 8,
                padding: "4px 8px",
                fontSize: 11,
              }}
              message="本护栏已阻断 Run 下游使用"
              description="本 Run 输出不允许 Accept；请按处置建议修改输入后重试。"
            />
          )}

          {/* 警告提示 */}
          {isWarning && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{
                marginTop: 8,
                padding: "4px 8px",
                fontSize: 11,
              }}
              message="本护栏记录警告但允许通过"
              description="本 Run 输出可继续 Accept，但需进入人工复核并说明警告处理。"
            />
          )}

          {/* 耗时与时间 */}
          <div style={{ marginTop: 8, fontSize: 10, color: "#999" }}>
            {guardrail.latencyMs !== null &&
              guardrail.latencyMs !== undefined && (
                <span>耗时 {guardrail.latencyMs}ms · </span>
              )}
            <span>
              检查于 {new Date(guardrail.checkedAt).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
      }
    />
  );
}
