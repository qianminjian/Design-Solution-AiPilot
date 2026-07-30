"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Modal,
  Progress,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tabs,
  Timeline,
  Typography,
  App,
} from "antd";
import {
  RobotOutlined,
  ExperimentOutlined,
  RocketOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  BranchesOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { GovernanceRelease } from "@design-platform/shared";
import { useReleases, useReleaseAction } from "@/hooks/use-governance";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;

/**
 * Release 类型别名（对齐 shared 契约 GovernanceRelease）
 *
 * 字段说明详见 packages/shared/src/schemas/governance.schema.ts
 */
type ReleaseDto = GovernanceRelease;

const TYPE_LABEL: Record<ReleaseDto["type"], string> = {
  llm: "LLM API",
  rule_set: "规则集",
  ai_provider: "建筑 AI",
};

const TYPE_COLOR: Record<ReleaseDto["type"], string> = {
  llm: "blue",
  rule_set: "geekblue",
  ai_provider: "purple",
};

const STATUS_LABEL: Record<ReleaseDto["status"], string> = {
  draft: "草稿",
  review: "评审中",
  canary: "灰度中",
  promoted: "已发布",
  rolled_back: "已回滚",
  deprecated: "已弃用",
};

const STATUS_COLOR: Record<ReleaseDto["status"], string> = {
  draft: "default",
  review: "warning",
  canary: "processing",
  promoted: "success",
  rolled_back: "error",
  deprecated: "default",
};

const REDTEAM_COLOR: Record<ReleaseDto["redteamStatus"], string> = {
  pass: "success",
  warning: "warning",
  fail: "error",
  pending: "default",
};

const REDTEAM_LABEL: Record<ReleaseDto["redteamStatus"], string> = {
  pass: "通过",
  warning: "警告",
  fail: "失败",
  pending: "待测",
};

const DRIFT_COLOR: Record<ReleaseDto["metricsDrift"], string> = {
  none: "success",
  minor: "warning",
  major: "error",
};

const DRIFT_LABEL: Record<ReleaseDto["metricsDrift"], string> = {
  none: "无漂移",
  minor: "轻微漂移",
  major: "严重漂移",
};

/**
 * AI/Rule Release 页面（D37.17 治理中心）
 *
 * 首屏：
 *  - 状态卡片（草稿/灰度/已发布/已回滚）
 *  - Release 列表（按版本/类型/状态过滤）
 *  - 详情面板（Release diff / 评测切片 / 红队 / 消费者 / 灰度策略）
 *
 * 主要动作：approve / canary / promote / rollback
 *
 * 特殊状态：指标漂移 / 评测缺口 / 旧消费者
 */
export default function AiReleasePage() {
  const { message, modal } = App.useApp();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDto | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("releases");

  // 真实 API 数据查询
  const {
    data: releasesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReleases({ pageSize: 100 });
  const releases = releasesData?.list ?? [];
  const releaseAction = useReleaseAction();

  // 统计
  const summary = {
    draft: releases.filter((r) => r.status === "draft" || r.status === "review")
      .length,
    canary: releases.filter((r) => r.status === "canary").length,
    promoted: releases.filter((r) => r.status === "promoted").length,
    rolledBack: releases.filter((r) => r.status === "rolled_back").length,
  };

  const filtered =
    typeFilter === "all"
      ? releases
      : releases.filter((r) => r.type === typeFilter);

  // 执行 Release 动作（canary/promote/rollback 等）
  const executeReleaseAction = async (
    release: ReleaseDto,
    action: "canary" | "promote" | "rollback",
    options?: { canaryPercent?: number },
  ) => {
    const reasonMap = {
      canary: `扩大灰度到 ${options?.canaryPercent ?? release.canaryPercent + 20}%`,
      promote: `Promote ${release.name} ${release.version} 到生产`,
      rollback: `回滚 ${release.name} ${release.version} 到上一稳定版本`,
    } as const;

    try {
      await releaseAction.mutateAsync({
        id: release.id,
        payload: {
          action,
          reason: reasonMap[action],
          canaryPercent: options?.canaryPercent,
        },
      });
      message.success(`${release.name} ${release.version} ${action} 操作成功`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "操作失败";
      message.error(errMsg);
    }
  };

  const handlePromote = (release: ReleaseDto) => {
    modal.confirm({
      title: `Promote ${release.name} ${release.version} 到生产？`,
      icon: <RocketOutlined />,
      content: (
        <Space direction="vertical" size={4}>
          <Text>
            此操作将影响 {release.consumerCount} 个消费者，灰度比例从{" "}
            {release.canaryPercent}% 提升至 100%。
          </Text>
          {release.hasEvalGap && (
            <Alert
              type="error"
              showIcon
              message="存在评测缺口"
              description="根据 D37.17，存在评测缺口的 Release 不可直接 Promote，需先补齐评测切片。"
              style={{ marginTop: 8 }}
            />
          )}
          {release.metricsDrift === "major" && (
            <Alert
              type="warning"
              showIcon
              message="指标漂移严重"
              description="指标漂移严重，建议先扩大灰度比例观察，或回滚到上一稳定版本。"
              style={{ marginTop: 8 }}
            />
          )}
        </Space>
      ),
      okText: "确认 Promote",
      okType: release.hasEvalGap ? "default" : "primary",
      okButtonProps: {
        disabled: release.hasEvalGap,
        loading: releaseAction.isPending,
      },
      cancelText: "取消",
      onOk: () => executeReleaseAction(release, "promote"),
    });
  };

  const handleCanary = (release: ReleaseDto) => {
    const next = Math.min(release.canaryPercent + 20, 100);
    void executeReleaseAction(release, "canary", { canaryPercent: next });
  };

  const handleRollback = (release: ReleaseDto) => {
    modal.confirm({
      title: `回滚 ${release.name} ${release.version}？`,
      icon: <RollbackOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>
            此操作将立即回滚到上一稳定版本，所有消费者将切换到旧版本。
          </Text>
          <Alert
            type="warning"
            showIcon
            message="影响预览"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 受影响消费者：{release.consumerCount} 个</Text>
                <Text>· 正在进行的 AI Run：可能中断，建议先 drain 队列</Text>
                <Text>· 审计：操作将记录到 Audit Log</Text>
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认回滚",
      okType: "danger",
      okButtonProps: { loading: releaseAction.isPending },
      cancelText: "取消",
      onOk: () => executeReleaseAction(release, "rollback"),
    });
  };

  const columns: ColumnsType<ReleaseDto> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 200,
      fixed: "left",
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            <Tag color={TYPE_COLOR[record.type]}>{TYPE_LABEL[record.type]}</Tag>
          </Space>
          <Text code style={{ fontSize: 11 }}>
            {record.version}
            {record.previousVersion && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {" "}
                ← {record.previousVersion}
              </Text>
            )}
          </Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: ReleaseDto["status"]) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "评测得分",
      dataIndex: "evalScore",
      key: "evalScore",
      width: 130,
      render: (score: number, record) => (
        <Space direction="vertical" size={0}>
          <Progress
            percent={score * 100}
            size="small"
            status={
              score >= 0.85 ? "success" : score >= 0.75 ? "normal" : "exception"
            }
            format={(p) => `${(p! / 100).toFixed(2)}`}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.evalSlices} 切片
          </Text>
        </Space>
      ),
    },
    {
      title: "红队测试",
      dataIndex: "redteamStatus",
      key: "redteamStatus",
      width: 100,
      render: (s: ReleaseDto["redteamStatus"]) => (
        <Tag color={REDTEAM_COLOR[s]}>{REDTEAM_LABEL[s]}</Tag>
      ),
    },
    {
      title: "消费者",
      dataIndex: "consumerCount",
      key: "consumerCount",
      width: 100,
      align: "right",
      render: (n: number, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{n}</Text>
          {record.hasOldConsumer && (
            <Tag color="orange" style={{ fontSize: 11 }}>
              旧版本
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "灰度",
      dataIndex: "canaryPercent",
      key: "canaryPercent",
      width: 110,
      render: (p: number) => (
        <Progress
          percent={p}
          size="small"
          status={p === 100 ? "success" : "active"}
        />
      ),
    },
    {
      title: "指标漂移",
      dataIndex: "metricsDrift",
      key: "metricsDrift",
      width: 110,
      render: (d: ReleaseDto["metricsDrift"]) => (
        <Tag color={DRIFT_COLOR[d]}>{DRIFT_LABEL[d]}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      fixed: "right",
      render: (_, record) => {
        const canPromote =
          record.status === "canary" || record.status === "review";
        const canCanary =
          record.status === "review" || record.status === "canary";
        const canRollback =
          record.status === "promoted" || record.status === "canary";
        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedRelease(record);
                setDetailOpen(true);
              }}
            >
              详情
            </Button>
            {canCanary && (
              <Button
                type="link"
                size="small"
                icon={<ExperimentOutlined />}
                onClick={() => handleCanary(record)}
              >
                扩大灰度
              </Button>
            )}
            {canPromote && (
              <Button
                type="link"
                size="small"
                icon={<RocketOutlined />}
                disabled={record.hasEvalGap || record.metricsDrift === "major"}
                onClick={() => handlePromote(record)}
              >
                Promote
              </Button>
            )}
            {canRollback && (
              <Button
                type="link"
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRollback(record)}
              >
                回滚
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8 }} />
            AI / 规则发布
          </Title>
          <Text type="secondary">
            Governance · AI/Rule Release（D37.17）· Release Diff / 评测 / 红队 /
            灰度 / 回滚 · 指标漂移与评测缺口阻断 Promote
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="对接后端真实 API"
        description="已对接 Release Service（D37.17）：列表/详情/Canary/Promote/Rollback 操作通过 BFF 代理转发到 Core Service；所有操作将记录审计日志，并触发消费者通知。后端未返回数据时显示空状态。"
      />

      {isError && (
        <DataErrorAlert
          error={error}
          context="Release 列表"
          variant="result"
          onRetry={() => void refetch()}
          retryLabel="重试加载"
        />
      )}

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spin tip="加载 Release 列表..." size="large" />
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "releases",
            label: (
              <span>
                <BranchesOutlined /> Release 列表
              </span>
            ),
            children: (
              <>
                {/* 状态卡片 */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="评审中"
                        value={summary.draft}
                        prefix={
                          <ExclamationCircleOutlined
                            style={{ color: "#fa8c16" }}
                          />
                        }
                        valueStyle={{ color: "#fa8c16" }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="灰度中"
                        value={summary.canary}
                        prefix={
                          <ExperimentOutlined style={{ color: "#1677ff" }} />
                        }
                        valueStyle={{ color: "#1677ff" }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="已发布"
                        value={summary.promoted}
                        prefix={
                          <CheckCircleOutlined style={{ color: "#52c41a" }} />
                        }
                        valueStyle={{ color: "#52c41a" }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="已回滚"
                        value={summary.rolledBack}
                        prefix={
                          <RollbackOutlined style={{ color: "#cf1322" }} />
                        }
                        valueStyle={{ color: "#cf1322" }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 类型筛选 */}
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Segmented
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as string)}
                    options={[
                      { label: "全部", value: "all" },
                      { label: "LLM API", value: "llm" },
                      { label: "规则集", value: "rule_set" },
                      { label: "建筑 AI", value: "ai_provider" },
                    ]}
                  />
                </Card>

                {/* Release 表格 */}
                <Card size="small">
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filtered}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1500 }}
                    locale={{ emptyText: <Empty description="无 Release" /> }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: "consumers",
            label: (
              <span>
                <SafetyCertificateOutlined /> 消费者
              </span>
            ),
            children: <ConsumersTab releases={releases} />,
          },
        ]}
      />

      {/* 详情 Modal */}
      <Modal
        title={
          selectedRelease ? (
            <Space>
              <RobotOutlined />
              <Text>{selectedRelease.name}</Text>
              <Text code>{selectedRelease.version}</Text>
            </Space>
          ) : (
            "Release 详情"
          )
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedRelease(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ]}
        width={680}
      >
        {selectedRelease && <ReleaseDetail release={selectedRelease} />}
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * 所有 Promote/Canary/Rollback 操作通过 BFF 代理转发到 Core Service
        ReleaseService，并写入审计日志。
      </Text>
    </Space>
  );
}

/** Release 详情 */
function ReleaseDetail({ release }: { release: ReleaseDto }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="类型">
          <Tag color={TYPE_COLOR[release.type]}>{TYPE_LABEL[release.type]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={STATUS_COLOR[release.status]}>
            {STATUS_LABEL[release.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="版本">
          <Text code>{release.version}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="上一版本">
          {release.previousVersion ? (
            <Text code>{release.previousVersion}</Text>
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="发布经理">
          {release.releaseManager}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(release.createdAt).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="Promote 时间" span={2}>
          {release.promotedAt
            ? new Date(release.promotedAt).toLocaleString("zh-CN")
            : "未发布"}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {release.description}
        </Descriptions.Item>
      </Descriptions>

      {/* Release diff 摘要 */}
      <Card size="small" title="Release Diff 摘要">
        <Row gutter={12}>
          <Col span={8}>
            <Statistic
              title="新增"
              value={release.diffSummary.added}
              valueStyle={{ color: "#52c41a" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="修改"
              value={release.diffSummary.modified}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="删除"
              value={release.diffSummary.removed}
              valueStyle={{ color: "#cf1322" }}
            />
          </Col>
        </Row>
      </Card>

      {/* 评测与红队 */}
      <Card size="small" title="评测 / 切片 / 红队">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="评测得分">
            <Progress
              percent={release.evalScore * 100}
              size="small"
              status={release.evalScore >= 0.85 ? "success" : "exception"}
              format={(p) => `${(p! / 100).toFixed(2)}`}
            />
          </Descriptions.Item>
          <Descriptions.Item label="评测切片">
            <Text strong>{release.evalSlices}</Text> 个
          </Descriptions.Item>
          <Descriptions.Item label="红队测试">
            <Tag color={REDTEAM_COLOR[release.redteamStatus]}>
              {REDTEAM_LABEL[release.redteamStatus]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="评测缺口">
            {release.hasEvalGap ? (
              <Tag color="red" icon={<WarningOutlined />}>
                存在缺口
              </Tag>
            ) : (
              <Tag color="green">无缺口</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 消费者与灰度 */}
      <Card size="small" title="消费者与灰度策略">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="消费者数">
            <Text strong>{release.consumerCount}</Text> 个
          </Descriptions.Item>
          <Descriptions.Item label="灰度比例">
            <Progress percent={release.canaryPercent} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="指标漂移">
            <Tag color={DRIFT_COLOR[release.metricsDrift]}>
              {DRIFT_LABEL[release.metricsDrift]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="旧版本消费者">
            {release.hasOldConsumer ? (
              <Tag color="orange">存在旧消费者</Tag>
            ) : (
              <Tag color="green">无</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 发布时间线 */}
      <Card size="small" title="发布时间线">
        <Timeline
          items={
            [
              {
                color: "gray",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>草稿创建</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(release.createdAt).toLocaleString("zh-CN")} ·{" "}
                      {release.releaseManager}
                    </Text>
                  </Space>
                ),
              },
              release.status !== "draft" && {
                color: "blue",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>进入评审</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      评测 {release.evalSlices} 切片 · 红队{" "}
                      {REDTEAM_LABEL[release.redteamStatus]}
                    </Text>
                  </Space>
                ),
              },
              (release.status === "canary" ||
                release.status === "promoted") && {
                color: "orange",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>灰度发布 {release.canaryPercent}%</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      消费者 {release.consumerCount} 个 · 指标漂移{" "}
                      {DRIFT_LABEL[release.metricsDrift]}
                    </Text>
                  </Space>
                ),
              },
              release.status === "promoted" &&
                release.promotedAt && {
                  color: "green",
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>Promote 到生产</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(release.promotedAt).toLocaleString("zh-CN")}
                      </Text>
                    </Space>
                  ),
                },
              release.status === "rolled_back" && {
                color: "red",
                children: (
                  <Space direction="vertical" size={0}>
                    <Text strong>已回滚</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      回滚到 {release.previousVersion ?? "上一版本"}
                    </Text>
                  </Space>
                ),
              },
            ].filter(Boolean) as { color: string; children: React.ReactNode }[]
          }
        />
      </Card>
    </Space>
  );
}

interface ConsumerGroup {
  key: string;
  release: ReleaseDto;
  consumers: Array<{
    id: string;
    name: string;
    version: string;
    canaryPercent: number;
    status: ReleaseDto["status"];
  }>;
}

/** 消费者 Tab */
function ConsumersTab({ releases }: { releases: ReleaseDto[] }) {
  const consumers = useMemo<ConsumerGroup[]>(() => {
    return releases
      .filter((r) => r.status === "promoted" || r.status === "canary")
      .map((r): ConsumerGroup => ({
        key: r.id,
        release: r,
        consumers: Array.from(
          { length: Math.min(r.consumerCount, 5) },
          (_, i) => ({
            id: `consumer-${r.id}-${i + 1}`,
            name: `Consumer ${i + 1} (${r.name})`,
            version: r.version,
            canaryPercent: r.canaryPercent,
            status: r.status,
          }),
        ),
      }));
  }, [releases]);

  return (
    <Card size="small" title="消费者列表（按 Release 分组）">
      {consumers.length === 0 ? (
        <Empty description="无消费者" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {consumers.map((group) => (
            <Card
              key={group.key}
              size="small"
              type="inner"
              title={
                <Space>
                  <Text strong>{group.release.name}</Text>
                  <Text code>{group.release.version}</Text>
                  <Tag color={STATUS_COLOR[group.release.status]}>
                    {STATUS_LABEL[group.release.status]}
                  </Tag>
                </Space>
              }
            >
              <Table
                rowKey="id"
                size="small"
                columns={[
                  {
                    title: "Consumer ID",
                    dataIndex: "id",
                    key: "id",
                    render: (v: string) => <Text code>{v}</Text>,
                  },
                  { title: "名称", dataIndex: "name", key: "name" },
                  {
                    title: "版本",
                    dataIndex: "version",
                    key: "version",
                    render: (v: string) => <Text code>{v}</Text>,
                  },
                  {
                    title: "灰度",
                    dataIndex: "canaryPercent",
                    key: "canaryPercent",
                    render: (p: number) => (
                      <Progress percent={p} size="small" />
                    ),
                  },
                ]}
                dataSource={group.consumers}
                pagination={false}
              />
            </Card>
          ))}
        </Space>
      )}
      <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        * 消费者列表基于 Release.consumerCount 派生（每 Release 最多展示 5
        个）；V1 接入 Consumer Registry 后将完整列出真实消费者。
      </Paragraph>
    </Card>
  );
}
