"use client";

import {
  Typography,
  Spin,
  Alert,
  Button,
  Space,
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Empty,
  App,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { CheckResultDto } from "@design-platform/shared";
import {
  CHECK_RUN_STATUS_LABEL,
  CHECK_RUN_STATUS_TAG_COLOR,
} from "@design-platform/shared";
import {
  useComplianceCheckRun,
  useCheckResults,
  useExecuteComplianceCheckRun,
} from "@/hooks/use-compliance";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { CoveragePanel } from "@/components/compliance/coverage-panel";
import { ResultTree } from "@/components/compliance/result-tree";
import { ResultDetailRail } from "@/components/compliance/result-detail-rail";
import { VerifyExceptionForm } from "@/components/compliance/verify-exception-form";
import { RuleSetBadge } from "@/components/compliance/rule-set-badge";

const { Title, Text } = Typography;

/**
 * P08 规则检查与规范证据审阅器（D37.12）
 *
 * 设计规格（@design/D37-关键界面-交互状态.md §D37.12）：
 * - 路由：/compliance-results/{id}（对齐设计基线的 /compliance-results/{id}）
 * - 布局：左侧规则/结果树；中部 Viewer/文档条文；右侧结果、引用、证据、验证/例外
 * - 核心组件：RuleSetBadge、CoveragePanel、ResultGrid、ClauseViewer、CitationCard、EvidenceGraph、Verify/Exception form
 * - 主动作：验证结果/创建 Issue/发起 Exception；AI 解释不能改变 Pass/Fail/Unknown
 * - 正常状态：每结果显示规则/Edition/Clause、输入版本、对象、计算/断言、证据、engine release 和 reviewer
 * - Unknown/NotApplicable：显式原因与补充输入/专业判断路径，不并入 Pass；覆盖率分母包含未执行/未知
 * - 引用不可用：许可/版本/页码不可访问时保留 locator/hash 和访问申请，不展示编造摘要
 * - Exception：影响范围、依据、期限、补偿控制、签审角色；审批后结果仍保留原判定并链接例外
 *
 * V0 实现范围：
 * - ✅ 三栏布局
 * - ✅ CoveragePanel 覆盖率统计（含 Unknown/NotApplicable 分母）
 * - ✅ ResultTree 结果树（按 objectType 分组）
 * - ✅ ResultDetailRail 结果详情（含 evidence、explanation）
 * - ✅ VerifyExceptionForm Exception 草稿（前端态，V1 接入后端）
 * - ✅ RuleSetBadge 规则集徽章
 * - ✅ Unknown/NotApplicable 显式原因提示
 * - ⏸ ClauseViewer/CitationCard/EvidenceGraph 待 V1（依赖 BIM Viewer 与规范条文库）
 * - ⏸ Issue 创建待 V1（依赖 Issue API）
 * - ⏸ Exception 审批工作流待 V1（依赖 Exception API）
 */
export default function ComplianceResultDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const checkRunId = params?.id;

  const [selectedResultId, setSelectedResultId] = useState<
    string | undefined
  >();

  const {
    data: checkRun,
    isLoading,
    error,
    refetch,
  } = useComplianceCheckRun(checkRunId);

  const executeMutation = useExecuteComplianceCheckRun();

  // V0：取第一个 execution 的 results，V1 扩展为多 execution 聚合
  const firstExecutionId = checkRun?.executions?.[0]?.id;
  const { data: resultsData, isLoading: resultsLoading } = useCheckResults(
    firstExecutionId,
    { page: 1, pageSize: 200 },
  );

  if (!checkRunId) {
    return (
      <Alert
        type="error"
        message="缺少检查运行 ID"
        description="请通过 /compliance-checks 列表进入详情页"
      />
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin tip="加载检查运行..." />
      </div>
    );
  }

  if (error) {
    return <DataErrorAlert error={error} context="检查运行详情" />;
  }

  if (!checkRun) {
    return (
      <Alert
        type="warning"
        message="检查运行不存在"
        description={`未找到 ID 为 ${checkRunId} 的检查运行`}
      />
    );
  }

  const results: CheckResultDto[] = resultsData?.items ?? [];
  const selectedResult = results.find((r) => r.id === selectedResultId) ?? null;

  const statusLabel =
    CHECK_RUN_STATUS_LABEL[checkRun.status] ?? checkRun.status;
  const statusColor = CHECK_RUN_STATUS_TAG_COLOR[checkRun.status] ?? "default";

  const handleExecute = () => {
    executeMutation.mutate(checkRunId, {
      onSuccess: () => message.success("检查执行已启动"),
      onError: (err: Error) => message.error(`执行失败: ${err.message}`),
    });
  };

  return (
    <div>
      {/* 顶部导航 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push("/compliance-checks")}
          >
            返回检查运行列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            P08 规则检查与规范证据审阅器
          </Title>
          <Tag color={statusColor} icon={<FileSearchOutlined />}>
            {statusLabel}
          </Tag>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
          {(checkRun.status === "PENDING" || checkRun.status === "FAILED") && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={executeMutation.isPending}
              onClick={handleExecute}
            >
              启动执行
            </Button>
          )}
        </Space>
      </div>

      {/* 检查运行元信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={3} size="small">
          <Descriptions.Item label="检查运行 ID" span={3}>
            <Text code copyable>
              {checkRun.id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="规则集">
            <RuleSetBadge ruleSetId={checkRun.ruleSetId} />
          </Descriptions.Item>
          <Descriptions.Item label="项目 ID">
            {checkRun.projectId ? (
              <Text code>{checkRun.projectId}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="执行记录数">
            {checkRun.executions?.length ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {checkRun.startedAt
              ? new Date(checkRun.startedAt).toLocaleString("zh-CN")
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {checkRun.completedAt
              ? new Date(checkRun.completedAt).toLocaleString("zh-CN")
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="结果摘要">
            {checkRun.outcomeSummary || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 覆盖率面板 */}
      <div style={{ marginBottom: 16 }}>
        <CoveragePanel results={results} loading={resultsLoading} />
      </div>

      {/* 三栏布局：结果树 + 详情 + Exception 表单 */}
      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <Card
            size="small"
            title={<Text strong>结果树</Text>}
            styles={{ body: { padding: 8, maxHeight: 600, overflow: "auto" } }}
          >
            {results.length === 0 && !resultsLoading ? (
              <Empty
                description={
                  checkRun.status === "COMPLETED"
                    ? "暂无检查结果数据"
                    : "检查运行尚未完成，请先点击「启动执行」"
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <ResultTree
                results={results}
                loading={resultsLoading}
                selectedKey={selectedResultId}
                onSelect={(id) => setSelectedResultId(id)}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <ResultDetailRail result={selectedResult} />
        </Col>

        <Col xs={24} lg={6}>
          <VerifyExceptionForm result={selectedResult} />
        </Col>
      </Row>

      {/* V0 限制说明 */}
      <Alert
        style={{ marginTop: 16 }}
        type="info"
        showIcon
        message="V0 实现限制说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <Text strong>ClauseViewer / CitationCard / EvidenceGraph</Text>：
              依赖 BIM Viewer 与规范条文库，V1 阶段接入
            </li>
            <li>
              <Text strong>创建 Issue</Text>：依赖 Issue API，V1 阶段接入
            </li>
            <li>
              <Text strong>Exception 草稿</Text>：当前为前端态，V1
              阶段接入后端审批工作流
            </li>
            <li>
              <Text strong>多 Execution 聚合</Text>：V0 仅展示首个 execution 的
              results，V1 扩展为多 execution 聚合
            </li>
          </ul>
        }
      />
    </div>
  );
}
