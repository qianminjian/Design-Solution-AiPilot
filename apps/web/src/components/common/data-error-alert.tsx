"use client";

import { Alert, Result, Button, Typography, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";

const { Text } = Typography;

/**
 * 数据错误兜底组件
 *
 * 错误分类与展示策略：
 * 1. ResponseValidationError（schema 校验失败）：
 *    - 标题："数据格式异常"
 *    - 详情：列出 schema 失败字段（path=message）
 *    - 提示：联系管理员排查契约漂移
 *    - 不弹 toast，避免干扰用户操作
 *
 * 2. ApiError（HTTP/业务错误）：
 *    - 标题：根据 status 区分（404 / 403 / 500 ...）
 *    - 详情：errorCode + 后端返回的 title/detail
 *
 * 3. 普通 Error：
 *    - 标题："数据加载失败"
 *    - 详情：error.message 或通用提示
 *
 * 用法：
 *  - variant="inline"：行内 Alert，适合卡片/列表区域
 *  - variant="result"：整页 Result，适合页面级错误
 */
interface DataErrorAlertProps {
  /** 错误对象（来自 React Query 的 error 字段） */
  error: unknown;
  /** 上下文描述，如"项目列表" / "AI 生成记录"，用于错误消息 */
  context?: string;
  /** 重试回调，提供时显示重试按钮 */
  onRetry?: () => void;
  /** 重试按钮文案，默认"重试" */
  retryLabel?: string;
  /** 渲染样式：inline（默认，行内 Alert）/ result（整页 Result） */
  variant?: "inline" | "result";
}

/** 从错误对象提取展示信息 */
function describeError(
  error: unknown,
  context: string,
): {
  title: string;
  description: string;
  details?: string;
} {
  if (error instanceof ResponseValidationError) {
    const issues = error.issues.map((i) => `${i.path}=${i.message}`).join("; ");
    return {
      title: "数据格式异常",
      description: `${context}数据未通过 schema 校验，可能存在契约漂移。请联系管理员排查。`,
      details: `[${error.context}] ${issues}`,
    };
  }

  if (error instanceof ApiError) {
    const isNotFound = error.status === 404;
    const isForbidden = error.status === 403;
    const title = isNotFound
      ? `${context}不存在`
      : isForbidden
        ? "无权访问"
        : `${context}加载失败`;
    return {
      title,
      description: error.message,
      details: `errorCode=${error.errorCode}, status=${error.status}${error.traceId ? `, traceId=${error.traceId}` : ""}`,
    };
  }

  if (error instanceof Error) {
    return {
      title: `${context}加载失败`,
      description: error.message || "请稍后重试",
    };
  }

  return {
    title: `${context}加载失败`,
    description: "请稍后重试",
  };
}

/**
 * 数据错误兜底组件
 *
 * 替代 message.error() toast 模式：
 *  - toast 频繁弹出会干扰用户操作
 *  - schema 校验失败用户难以理解，弹了也不知道怎么办
 *  - inline Alert 让用户在数据加载位置看到错误，便于排查
 */
export function DataErrorAlert({
  error,
  context = "数据",
  onRetry,
  retryLabel = "重试",
  variant = "inline",
}: DataErrorAlertProps) {
  const { title, description, details } = describeError(error, context);
  const isNotFound = error instanceof ApiError && error.status === 404;

  if (variant === "result") {
    return (
      <Result
        status={isNotFound ? "404" : "error"}
        title={title}
        subTitle={
          <Space direction="vertical" size={4}>
            <Text type="secondary">{description}</Text>
            {details && (
              <Text type="secondary" code style={{ fontSize: 12 }}>
                {details}
              </Text>
            )}
          </Space>
        }
        extra={
          onRetry && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              {retryLabel}
            </Button>
          )
        }
      />
    );
  }

  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={
        <Space direction="vertical" size={4}>
          <Text>{description}</Text>
          {details && (
            <Text type="secondary" code style={{ fontSize: 12 }}>
              {details}
            </Text>
          )}
          {onRetry && (
            <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
        </Space>
      }
    />
  );
}
