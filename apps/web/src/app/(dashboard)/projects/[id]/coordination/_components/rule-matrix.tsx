"use client";

import { Alert, Empty, Spin, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  ClashRuleDto,
  CoordinationCheckType,
} from "@design-platform/shared";
import { useCoordinationRules } from "@/hooks/use-coordination";

const { Text } = Typography;

/**
 * P07 协调工作台左侧 RuleMatrix 规则矩阵
 * 对齐 D37.11 §布局「Run/规则选择」 + §正常状态「显示规则/容差」
 *
 * 功能：
 *  - 列出项目下所有 ClashRule
 *  - 按专业对（disciplineA × disciplineB）和检查类型分组
 *  - 显示容差、启用状态、关联 Run
 *  - 支持勾选规则参与 Run（V0 仅展示）
 *
 * V0：后端 Coordination API 未就位时显示空状态
 */

const CHECK_TYPE_COLOR: Record<CoordinationCheckType, string> = {
  CLASH: "red",
  CLEARANCE: "orange",
  CONSISTENCY: "blue",
  CODE_CHECK: "purple",
};

const CHECK_TYPE_LABEL: Record<CoordinationCheckType, string> = {
  CLASH: "碰撞",
  CLEARANCE: "间距",
  CONSISTENCY: "一致性",
  CODE_CHECK: "规范",
};

interface RuleMatrixProps {
  projectId: string;
  /** 选中 Run 应用的规则 ID 列表（用于高亮） */
  appliedRuleIds?: string[];
  onRuleSelect?: (rule: ClashRuleDto) => void;
}

export function RuleMatrix({
  projectId,
  appliedRuleIds,
  onRuleSelect,
}: RuleMatrixProps) {
  const { data, isLoading, isError, error } = useCoordinationRules(projectId);

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin tip="加载规则矩阵..." />
      </div>
    );
  }

  if (isError) {
    const status = (error as { status?: number })?.status;
    const isNotImplemented = status === 404 || status === 501;
    return (
      <Alert
        type={isNotImplemented ? "info" : "error"}
        showIcon
        message={isNotImplemented ? "规则 API 待 V1 实现" : "加载规则失败"}
        description={
          isNotImplemented
            ? "后端 Coordination Rule API 尚未接入，V0 阶段展示空状态。"
            : "请稍后重试或联系管理员"
        }
        style={{ margin: 12 }}
      />
    );
  }

  const rules = data ?? [];

  const columns: ColumnsType<ClashRuleDto> = [
    {
      title: "编号",
      dataIndex: "code",
      key: "code",
      width: 90,
      render: (code: string, record) => {
        const isApplied = appliedRuleIds?.includes(record.id);
        return (
          <Tooltip title={isApplied ? "应用于当前 Run" : undefined}>
            <Tag
              color={isApplied ? "blue" : "default"}
              style={{ fontFamily: "monospace", fontSize: 11 }}
              onClick={() => onRuleSelect?.(record)}
            >
              {code}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "规则",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "类型",
      dataIndex: "checkType",
      key: "checkType",
      width: 80,
      render: (t: CoordinationCheckType) => (
        <Tag color={CHECK_TYPE_COLOR[t]} style={{ fontSize: 11 }}>
          {CHECK_TYPE_LABEL[t]}
        </Tag>
      ),
    },
    {
      title: "专业对",
      key: "disciplines",
      width: 130,
      render: (_, record) => (
        <Text style={{ fontSize: 11 }}>
          {record.disciplineA} × {record.disciplineB}
        </Text>
      ),
    },
    {
      title: "容差",
      dataIndex: "tolerance",
      key: "tolerance",
      width: 70,
      align: "right" as const,
      render: (t?: number | null) =>
        t === null || t === undefined ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            —
          </Text>
        ) : (
          <Text style={{ fontSize: 11 }}>{t} mm</Text>
        ),
    },
    {
      title: "启用",
      dataIndex: "enabled",
      key: "enabled",
      width: 60,
      align: "center" as const,
      render: (e: boolean) => (e ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          规则矩阵
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          共 {rules.length} 项
        </Text>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {rules.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12 }}>
                暂无规则
                <br />
                规则定义后可创建协调运行
              </span>
            }
            style={{ marginTop: 60 }}
          />
        ) : (
          <Table<ClashRuleDto>
            columns={columns}
            dataSource={rules}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: "calc(100% - 40px)" }}
          />
        )}
      </div>
    </div>
  );
}
