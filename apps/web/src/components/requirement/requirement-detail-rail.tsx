"use client";

import { Card, Empty, Spin, Tag, Typography, Timeline, Alert } from "antd";
import { LinkOutlined, HistoryOutlined } from "@ant-design/icons";
import {
  useRequirement,
  useRequirementHistory,
  useTraceLinks,
} from "@/hooks/use-requirements";
import { ApiError } from "@/lib/api-client";

const { Text, Paragraph } = Typography;

/** 判断是否为后端未实现错误 */
function isNotImplementedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 501;
  }
  return false;
}

interface RequirementDetailRailProps {
  /** 选中的需求 ID */
  requirementId: string | null;
  /** 项目 ID */
  projectId: string;
}

/**
 * D37.7 P03 右侧详情 Rail
 *
 * 展示选中需求的：
 *  - 基础信息（标题 / 描述 / 来源 / locator）
 *  - 类别 / 优先级 / 状态
 *  - Linked Design Elements（TraceLink 列表）
 *  - Change History（变更历史时间线）
 *
 * 空状态：未选中需求时显示提示
 */
export function RequirementDetailRail({
  requirementId,
  projectId: _projectId,
}: RequirementDetailRailProps) {
  const {
    data: requirement,
    isLoading,
    isError,
    error,
  } = useRequirement(requirementId);

  const { data: traceLinks = [] } = useTraceLinks(requirementId);
  const { data: history = [] } = useRequirementHistory(requirementId);

  return (
    <Card
      size="small"
      title={
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LinkOutlined />
            <Text strong style={{ fontSize: 13 }}>
              需求详情
            </Text>
          </span>
          {requirement && (
            <Text code style={{ fontSize: 12 }}>
              {requirement.code}
            </Text>
          )}
        </span>
      }
      bodyStyle={{ padding: 12 }}
      style={{
        height: "100%",
        overflowY: "auto",
        maxHeight: "calc(100vh - 220px)",
      }}
    >
      {!requirementId ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="选中需求以查看详情"
          style={{ padding: 24 }}
        />
      ) : isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Spin />
        </div>
      ) : isError && !isNotImplementedError(error) ? (
        <Alert
          type="error"
          message="详情加载失败"
          description={(error as Error)?.message ?? "请稍后重试"}
          showIcon
        />
      ) : isError && isNotImplementedError(error) ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="需求详情 API 待 V1 实现"
          style={{ padding: 24 }}
        />
      ) : requirement ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 标题与描述 */}
          <div>
            <Text
              strong
              style={{ fontSize: 13, display: "block", marginBottom: 4 }}
            >
              {requirement.title}
            </Text>
            {requirement.description && (
              <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                {requirement.description}
              </Paragraph>
            )}
          </div>

          {/* 来源定位 */}
          {requirement.sourceLocator && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Source Locator
              </Text>
              <div>
                <Tag color="blue" style={{ fontSize: 11 }}>
                  {requirement.sourceLocator}
                </Tag>
              </div>
            </div>
          )}

          {/* 类别 / 优先级 / 状态 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              fontSize: 11,
            }}
          >
            <div>
              <Text type="secondary">Category</Text>
              <div>
                <Text style={{ fontSize: 12 }}>
                  {requirement.subCategory ?? requirement.category}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Priority</Text>
              <div>
                <Tag
                  color={
                    requirement.priority === "HIGH"
                      ? "red"
                      : requirement.priority === "MEDIUM"
                        ? "orange"
                        : "default"
                  }
                  style={{ fontSize: 11 }}
                >
                  {requirement.priority}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">Status</Text>
              <div>
                <Tag
                  color={
                    requirement.status === "APPROVED"
                      ? "success"
                      : requirement.status === "IMPLEMENTED"
                        ? "blue"
                        : requirement.status === "DRAFT"
                          ? "default"
                          : requirement.status === "IN_REVIEW"
                            ? "processing"
                            : requirement.status === "SUPERSEDED"
                              ? "warning"
                              : "error"
                  }
                  style={{ fontSize: 11 }}
                >
                  {requirement.status.replace("_", " ")}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">Linked</Text>
              <div>
                <Text style={{ fontSize: 12 }}>{requirement.linkedCount}</Text>
              </div>
            </div>
          </div>

          {/* Linked Design Elements */}
          <div>
            <Text
              type="secondary"
              style={{ fontSize: 11, display: "block", marginBottom: 4 }}
            >
              <LinkOutlined /> Linked Design Elements
            </Text>
            {traceLinks.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                暂无追踪链接（无 Trace 显示必需关系和建议，不自动创建虚假覆盖）
              </Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {traceLinks.map((link) => (
                  <div
                    key={link.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 6px",
                      background: "#f8fafc",
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    <Text code style={{ fontSize: 11 }}>
                      {link.targetCode}
                    </Text>
                    <Text style={{ fontSize: 11 }}>{link.targetName}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change History */}
          <div>
            <Text
              type="secondary"
              style={{ fontSize: 11, display: "block", marginBottom: 8 }}
            >
              <HistoryOutlined /> Change History
            </Text>
            {history.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                暂无变更历史
              </Text>
            ) : (
              <Timeline
                items={history.map((h) => ({
                  color: "blue",
                  children: (
                    <div style={{ fontSize: 11 }}>
                      <div>
                        <Text strong>{h.author}</Text>
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          {new Date(h.timestamp).toLocaleString()}
                        </Text>
                      </div>
                      <Text type="secondary">{h.description}</Text>
                    </div>
                  ),
                }))}
              />
            )}
          </div>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="需求不存在"
          style={{ padding: 24 }}
        />
      )}
    </Card>
  );
}
