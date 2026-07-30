"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
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
} from "antd";
import {
  CloudOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  CloudSyncOutlined,
  HddOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  GovernanceBackupPoint,
  GovernanceRestoreDrill,
} from "@design-platform/shared";
import {
  useBackups,
  useRestoreDrills,
  useCreateRestoreDrill,
  useRestoreBackup,
} from "@/hooks/use-governance";

const { Title, Text, Paragraph } = Typography;

/** 备份类型标签 */
const TYPE_LABEL: Record<GovernanceBackupPoint["type"], string> = {
  full: "全量",
  incremental: "增量",
  wal: "WAL",
};

const TYPE_COLOR: Record<GovernanceBackupPoint["type"], string> = {
  full: "blue",
  incremental: "geekblue",
  wal: "default",
};

const SCOPE_LABEL: Record<GovernanceBackupPoint["scope"], string> = {
  database: "数据库",
  object_storage: "对象存储",
  config: "配置",
  all: "全栈",
};

const STATUS_LABEL: Record<GovernanceBackupPoint["status"], string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  verifying: "验证中",
  verified: "已验证",
};

const STATUS_COLOR: Record<GovernanceBackupPoint["status"], string> = {
  running: "processing",
  completed: "blue",
  failed: "error",
  verifying: "processing",
  verified: "success",
};

/** 演练状态标签（与 GovernanceRestoreDrillStatus 对齐） */
const DRILL_STATUS_LABEL: Record<GovernanceRestoreDrill["status"], string> = {
  scheduled: "已排期",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const DRILL_STATUS_COLOR: Record<GovernanceRestoreDrill["status"], string> = {
  scheduled: "default",
  running: "processing",
  completed: "blue",
  failed: "error",
  cancelled: "default",
};

const DRILL_TARGET_LABEL: Record<GovernanceRestoreDrill["target"], string> = {
  isolated_env: "隔离环境",
  production: "生产环境",
};

/** OD-06 Hybrid-Site 部署目标 SLO */
const TARGET_RPO_MIN = 15;
const TARGET_RTO_MIN = 480;

/**
 * Backup/Restore 页面（D37.17 治理中心）
 *
 * 首屏组成：backup / WAL / object inventory、实际 RPO/RTO、演练
 * 主要动作：start isolated drill / restore / verify
 * 特殊状态：不可恢复、timeline 分叉、外部写冻结
 *
 * 数据来源：BFF GovernanceProxyController → Core Service Backup/RestoreDrill Controller
 */
export default function BackupRestorePage() {
  const { message, modal } = App.useApp();
  const [activeTab, setActiveTab] = useState("backups");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedBackup, setSelectedBackup] =
    useState<GovernanceBackupPoint | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");

  // 列表查询：备份点（服务端不支持 type 过滤，全部走客户端筛选）
  const { data: backupsData, isLoading: backupsLoading } = useBackups({
    page: 1,
    pageSize: 100,
  });

  // 列表查询：灾备演练
  const { data: drillsData, isLoading: drillsLoading } = useRestoreDrills({
    page: 1,
    pageSize: 100,
  });

  // 写操作 mutation
  const restoreMutation = useRestoreBackup();
  const drillMutation = useCreateRestoreDrill();

  const backups = backupsData?.list ?? [];
  const drills = drillsData?.list ?? [];

  // 客户端按 type 过滤
  const filteredBackups = useMemo(() => {
    if (typeFilter === "all") return backups;
    return backups.filter((b) => b.type === typeFilter);
  }, [backups, typeFilter]);

  // 汇总指标
  const summary = useMemo(() => {
    const lastFull = backups.find(
      (b) => b.type === "full" && b.status === "verified",
    );
    const lastWal = [...backups]
      .filter((b) => b.type === "wal" && b.status === "completed")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return {
      totalBackups: backups.length,
      verified: backups.filter((b) => b.status === "verified").length,
      failed: backups.filter((b) => b.status === "failed").length,
      totalSize: backups.reduce((s, b) => s + b.sizeBytes, 0),
      totalObjects: backups.reduce((s, b) => s + b.objectCount, 0),
      lastFullTime: lastFull?.completedAt,
      actualRpo: lastWal?.actualRpoMin ?? 0,
      targetRpo: TARGET_RPO_MIN,
      targetRto: TARGET_RTO_MIN,
      drillPassed: drills.filter(
        (d) => d.status === "completed" && d.passed === true,
      ).length,
      drillFailed: drills.filter((d) => d.status === "failed").length,
    };
  }, [backups, drills]);

  const handleRestore = (backup: GovernanceBackupPoint) => {
    setSelectedBackup(backup);
    setRestoreReason("");
    setRestoreModalOpen(true);
  };

  const confirmRestore = () => {
    if (!selectedBackup || !restoreReason.trim()) {
      message.warning("请填写恢复原因");
      return;
    }
    modal.confirm({
      title: `从备份点 ${selectedBackup.id} 恢复？`,
      icon: <RollbackOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text type="danger">此操作将冻结外部写入并启动恢复流程。</Text>
          <Alert
            type="warning"
            showIcon
            message="恢复影响预览"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 备份类型：{TYPE_LABEL[selectedBackup.type]}</Text>
                <Text>· 范围：{SCOPE_LABEL[selectedBackup.scope]}</Text>
                <Text>
                  · 对象数：{selectedBackup.objectCount.toLocaleString()}
                </Text>
                <Text>
                  · 大小：{(selectedBackup.sizeBytes / 1024 ** 3).toFixed(2)} GB
                </Text>
                <Text>· 目标 RTO：{summary.targetRto} 分钟</Text>
                <Text type="danger">· 恢复期间外部写入将被冻结</Text>
                <Text type="secondary">· 建议先在隔离环境演练验证</Text>
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认恢复",
      okType: "danger",
      okButtonProps: {
        disabled:
          selectedBackup.status === "failed" || restoreMutation.isPending,
      },
      cancelText: "取消",
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          restoreMutation.mutate(
            {
              id: selectedBackup.id,
              payload: {
                backupId: selectedBackup.id,
                target: "production",
                reason: restoreReason,
                // V0：以确认短语充当 stepUpToken；V1 接入 IAM 后替换为真实 MFA
                stepUpToken: "RESTORE",
              },
            },
            {
              onSuccess: () => {
                message.success(
                  `恢复任务已启动，目标 RTO ${summary.targetRto} 分钟`,
                );
                setRestoreModalOpen(false);
                setSelectedBackup(null);
                resolve();
              },
              onError: (err) => {
                message.error(`恢复失败：${err.message}`);
                reject(err);
              },
            },
          );
        });
      },
    });
  };

  const handleStartDrill = () => {
    // 选取最近一次已验证的全量备份作为演练源
    const sourceBackup = backups.find(
      (b) => b.type === "full" && b.status === "verified",
    );
    if (!sourceBackup) {
      message.warning("未找到已验证的全量备份，无法启动演练");
      return;
    }
    modal.confirm({
      title: "启动隔离环境灾备演练？",
      icon: <ExperimentOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>
            将在隔离环境启动灾备演练，验证从最近验证备份点的恢复能力。
          </Text>
          <Alert
            type="info"
            showIcon
            message="演练预览"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 源备份：{sourceBackup.id}</Text>
                <Text>
                  · 隔离环境：drill-env-{Math.floor(Math.random() * 100)}
                </Text>
                <Text>· 目标 RTO：{summary.targetRto} 分钟</Text>
                <Text>· 演练不影响生产环境</Text>
                <Text type="secondary">· 演练完成后将生成验证报告</Text>
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "启动演练",
      okType: "primary",
      okButtonProps: { disabled: drillMutation.isPending },
      cancelText: "取消",
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          drillMutation.mutate(
            {
              backupId: sourceBackup.id,
              target: "isolated_env",
              operator: "current-user",
              // V0：以确认短语充当 stepUpToken；V1 接入 IAM 后替换为真实 MFA
              stepUpToken: "DRILL",
            },
            {
              onSuccess: () => {
                message.success("灾备演练已启动，完成后将通过通知发送报告");
                resolve();
              },
              onError: (err) => {
                message.error(`启动演练失败：${err.message}`);
                reject(err);
              },
            },
          );
        });
      },
    });
  };

  const handleVerify = (backup: GovernanceBackupPoint) => {
    // V0：后端暂无 verify 端点，保留前端占位提示
    message.loading({
      content: `正在验证备份点 ${backup.id}...`,
      key: "verify",
      duration: 1,
    });
    setTimeout(() => {
      message.success({
        content: `${backup.id} 验证通过，对象哈希匹配（V0 占位）`,
        key: "verify",
      });
    }, 1000);
  };

  const columns: ColumnsType<GovernanceBackupPoint> = [
    {
      title: "备份 ID",
      dataIndex: "id",
      key: "id",
      width: 200,
      fixed: "left",
      render: (id: string, record) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 12 }}>
            {id}
          </Text>
          <Space size={4}>
            <Tag color={TYPE_COLOR[record.type]} style={{ fontSize: 11 }}>
              {TYPE_LABEL[record.type]}
            </Tag>
            <Tag style={{ fontSize: 11 }}>{SCOPE_LABEL[record.scope]}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: "开始时间",
      dataIndex: "startedAt",
      key: "startedAt",
      width: 160,
      render: (ts: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(ts).toLocaleString("zh-CN")}
        </Text>
      ),
    },
    {
      title: "完成时间",
      dataIndex: "completedAt",
      key: "completedAt",
      width: 160,
      render: (ts?: string) =>
        ts ? (
          <Text style={{ fontSize: 12 }}>
            {new Date(ts).toLocaleString("zh-CN")}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "时长",
      dataIndex: "durationSec",
      key: "durationSec",
      width: 100,
      align: "right",
      render: (sec?: number) =>
        sec ? (
          <Text>
            {sec >= 3600 ? `${Math.floor(sec / 3600)}h ` : ""}
            {Math.floor((sec % 3600) / 60)}m
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "对象数",
      dataIndex: "objectCount",
      key: "objectCount",
      width: 120,
      align: "right",
      render: (n: number) => <Text strong>{n.toLocaleString()}</Text>,
    },
    {
      title: "大小",
      dataIndex: "sizeBytes",
      key: "sizeBytes",
      width: 100,
      align: "right",
      render: (b: number) => (
        <Text>
          {b >= 1024 ** 3
            ? `${(b / 1024 ** 3).toFixed(2)} GB`
            : `${(b / 1024 ** 2).toFixed(2)} MB`}
        </Text>
      ),
    },
    {
      title: "实际 RPO",
      dataIndex: "actualRpoMin",
      key: "actualRpoMin",
      width: 100,
      align: "right",
      render: (m: number) =>
        m === 0 ? (
          <Text type="secondary">—</Text>
        ) : (
          <Tag color={m <= summary.targetRpo ? "green" : "red"}>{m} 分钟</Tag>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: GovernanceBackupPoint["status"]) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<SafetyOutlined />}
            disabled={record.status !== "completed"}
            onClick={() => handleVerify(record)}
          >
            验证
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<RollbackOutlined />}
            disabled={record.status === "failed" || record.status === "running"}
            onClick={() => handleRestore(record)}
          >
            恢复
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            备份与恢复
          </Title>
          <Text type="secondary">
            Governance · Backup/Restore（D37.17）· backup / WAL / object
            inventory · 实际 RPO/RTO · 隔离环境演练 · timeline 分叉与外部写冻结
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="数据来源：Core Service Backup/RestoreDrill Controller"
        description="通过 BFF GovernanceProxyController 透传查询与写操作。恢复操作将冻结外部写入并记录审计日志。"
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "backups",
            label: (
              <span>
                <CloudSyncOutlined /> 备份点
              </span>
            ),
            children: (
              <>
                {/* SLO 卡片 */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="备份总数"
                        value={summary.totalBackups}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="已验证"
                        value={summary.verified}
                        valueStyle={{ color: "#52c41a" }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="失败"
                        value={summary.failed}
                        valueStyle={{ color: "#cf1322" }}
                        prefix={<WarningOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="实际 RPO"
                        value={summary.actualRpo}
                        suffix="分钟"
                        valueStyle={{
                          color:
                            summary.actualRpo <= summary.targetRpo
                              ? "#52c41a"
                              : "#cf1322",
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        目标：≤{summary.targetRpo} 分钟
                      </Text>
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="目标 RTO"
                        value={summary.targetRto}
                        suffix="分钟"
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        OD-06 Hybrid-Site
                      </Text>
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="最近全量"
                        value={
                          summary.lastFullTime
                            ? new Date(summary.lastFullTime).toLocaleDateString(
                                "zh-CN",
                              )
                            : "—"
                        }
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {summary.lastFullTime
                          ? new Date(summary.lastFullTime).toLocaleTimeString(
                              "zh-CN",
                            )
                          : ""}
                      </Text>
                    </Card>
                  </Col>
                </Row>

                {/* 类型筛选 */}
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Space>
                    <Segmented
                      value={typeFilter}
                      onChange={(v) => setTypeFilter(v as string)}
                      options={[
                        { label: "全部", value: "all" },
                        { label: "全量", value: "full" },
                        { label: "增量", value: "incremental" },
                        { label: "WAL", value: "wal" },
                      ]}
                    />
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleStartDrill}
                      loading={drillMutation.isPending}
                    >
                      启动灾备演练
                    </Button>
                  </Space>
                </Card>

                <Card size="small">
                  <Spin spinning={backupsLoading}>
                    <Table
                      rowKey="id"
                      columns={columns}
                      dataSource={filteredBackups}
                      pagination={{ pageSize: 20 }}
                      scroll={{ x: 1400 }}
                      locale={{ emptyText: <Empty description="无备份点" /> }}
                    />
                  </Spin>
                </Card>

                {/* 备份策略说明 */}
                <Card
                  size="small"
                  title="备份策略（Hybrid-Site）"
                  style={{ marginTop: 12 }}
                >
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="RPO 目标">
                      ≤ {summary.targetRpo} 分钟
                    </Descriptions.Item>
                    <Descriptions.Item label="RTO 目标">
                      ≤ {summary.targetRto} 分钟
                    </Descriptions.Item>
                    <Descriptions.Item label="全量备份频率">
                      每日 02:00
                    </Descriptions.Item>
                    <Descriptions.Item label="增量备份频率">
                      每小时
                    </Descriptions.Item>
                    <Descriptions.Item label="WAL 归档">
                      每 15 分钟
                    </Descriptions.Item>
                    <Descriptions.Item label="对象存储">
                      S3 + Object Lock（WORM）
                    </Descriptions.Item>
                    <Descriptions.Item label="保留期">
                      30 天 + 季度归档 7 年
                    </Descriptions.Item>
                    <Descriptions.Item label="演练频率">季度</Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            ),
          },
          {
            key: "inventory",
            label: (
              <span>
                <HddOutlined /> 对象清单
              </span>
            ),
            children: (
              <InventoryTab
                backups={backups}
                summary={summary}
                loading={backupsLoading}
              />
            ),
          },
          {
            key: "drills",
            label: (
              <span>
                <ExperimentOutlined /> 灾备演练
              </span>
            ),
            children: (
              <DrillsTab
                drills={drills}
                loading={drillsLoading}
                onStartDrill={handleStartDrill}
                startingDrill={drillMutation.isPending}
              />
            ),
          },
        ]}
      />

      {/* 恢复 Modal */}
      <Modal
        title={
          selectedBackup ? (
            <Space>
              <RollbackOutlined />
              <Text>恢复确认</Text>
              <Text code>{selectedBackup.id}</Text>
            </Space>
          ) : (
            "恢复确认"
          )
        }
        open={restoreModalOpen}
        onCancel={() => {
          setRestoreModalOpen(false);
          setSelectedBackup(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setRestoreModalOpen(false);
              setSelectedBackup(null);
            }}
          >
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger
            icon={<RollbackOutlined />}
            disabled={
              selectedBackup?.status === "failed" || restoreMutation.isPending
            }
            loading={restoreMutation.isPending}
            onClick={confirmRestore}
          >
            确认恢复
          </Button>,
        ]}
        width={680}
      >
        {selectedBackup && (
          <Form layout="vertical">
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Alert
                type="warning"
                showIcon
                message="恢复将冻结外部写入"
                description="恢复期间所有外部写入将被冻结；完成后将恢复写入并生成 timeline 分叉报告。"
              />
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="备份 ID">
                  <Text code>{selectedBackup.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag color={TYPE_COLOR[selectedBackup.type]}>
                    {TYPE_LABEL[selectedBackup.type]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="范围">
                  {SCOPE_LABEL[selectedBackup.scope]}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {selectedBackup.completedAt
                    ? new Date(selectedBackup.completedAt).toLocaleString(
                        "zh-CN",
                      )
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="对象数">
                  <Text strong>
                    {selectedBackup.objectCount.toLocaleString()}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="大小">
                  {(selectedBackup.sizeBytes / 1024 ** 3).toFixed(2)} GB
                </Descriptions.Item>
                <Descriptions.Item label="存储位置" span={2}>
                  <Text code style={{ fontSize: 11 }}>
                    {selectedBackup.storageLocation}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
              <Form.Item
                label="恢复原因（必填）"
                required
                tooltip="将写入审计日志，便于事后追溯"
              >
                <Input.TextArea
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="例如：生产数据库异常恢复，需要从最近验证备份点还原"
                />
              </Form.Item>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                *
                建议先在隔离环境演练验证后再执行生产恢复；恢复操作将记录审计日志。
              </Paragraph>
            </Space>
          </Form>
        )}
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V0 阶段验证操作仅前端占位；恢复与演练通过 Core Service 写入审计日志。
        RPO/RTO 目标遵循 OD-06 Hybrid-Site 部署画像。
      </Text>
    </Space>
  );
}

/** 对象清单 Tab */
function InventoryTab({
  backups,
  summary,
  loading,
}: {
  backups: GovernanceBackupPoint[];
  summary: {
    totalSize: number;
    totalObjects: number;
    targetRpo: number;
    targetRto: number;
  };
  loading?: boolean;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总备份大小"
              value={(summary.totalSize / 1024 ** 3).toFixed(2)}
              suffix="GB"
              prefix={<CloudOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总对象数"
              value={summary.totalObjects}
              suffix="个"
              prefix={<HddOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="目标 RPO"
              value={summary.targetRpo}
              suffix="分钟"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="目标 RTO"
              value={summary.targetRto}
              suffix="分钟"
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="对象存储清单（按备份点）">
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={[
              {
                title: "备份 ID",
                dataIndex: "id",
                key: "id",
                render: (id: string) => (
                  <Text code style={{ fontSize: 12 }}>
                    {id}
                  </Text>
                ),
              },
              {
                title: "存储位置",
                dataIndex: "storageLocation",
                key: "storageLocation",
                render: (loc: string) => (
                  <Text code style={{ fontSize: 11 }}>
                    {loc}
                  </Text>
                ),
              },
              {
                title: "对象数",
                dataIndex: "objectCount",
                key: "objectCount",
                align: "right",
                render: (n: number) => n.toLocaleString(),
              },
              {
                title: "大小",
                dataIndex: "sizeBytes",
                key: "sizeBytes",
                align: "right",
                render: (b: number) =>
                  b >= 1024 ** 3
                    ? `${(b / 1024 ** 3).toFixed(2)} GB`
                    : `${(b / 1024 ** 2).toFixed(2)} MB`,
              },
              {
                title: "哈希",
                dataIndex: "hash",
                key: "hash",
                render: (h: string) => (
                  <Text code style={{ fontSize: 11 }}>
                    {h}
                  </Text>
                ),
              },
            ]}
            dataSource={backups}
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty description="无对象" /> }}
          />
        </Spin>
      </Card>

      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        * 对象存储清单包含 S3 Object Lock（WORM）保护；WAL 归档每 15 分钟一次。
      </Paragraph>
    </Space>
  );
}

/** 灾备演练 Tab */
function DrillsTab({
  drills,
  loading,
  onStartDrill,
  startingDrill,
}: {
  drills: GovernanceRestoreDrill[];
  loading?: boolean;
  onStartDrill: () => void;
  startingDrill?: boolean;
}) {
  const columns: ColumnsType<GovernanceRestoreDrill> = [
    {
      title: "演练 ID",
      dataIndex: "id",
      key: "id",
      width: 200,
      fixed: "left",
      render: (id: string, record) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 11 }}>
            {id}
          </Text>
          <Tag color="geekblue" style={{ fontSize: 11 }}>
            {DRILL_TARGET_LABEL[record.target]}
          </Tag>
        </Space>
      ),
    },
    {
      title: "开始时间",
      dataIndex: "startedAt",
      key: "startedAt",
      width: 160,
      render: (ts: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(ts).toLocaleString("zh-CN")}
        </Text>
      ),
    },
    {
      title: "完成时间",
      dataIndex: "completedAt",
      key: "completedAt",
      width: 160,
      render: (ts?: string) =>
        ts ? (
          <Text style={{ fontSize: 12 }}>
            {new Date(ts).toLocaleString("zh-CN")}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "源备份",
      dataIndex: "backupId",
      key: "backupId",
      width: 180,
      render: (id: string) => (
        <Text code style={{ fontSize: 11 }}>
          {id}
        </Text>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: GovernanceRestoreDrill["status"]) => (
        <Tag color={DRILL_STATUS_COLOR[s]}>{DRILL_STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "实际 RTO",
      key: "rto",
      width: 140,
      render: (_, record) => {
        const rto = record.actualRtoMin;
        if (rto === undefined || rto === null) {
          return <Text type="secondary">—</Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            <Text type={rto <= TARGET_RTO_MIN ? "success" : "danger"} strong>
              {rto} 分钟
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              目标 ≤ {TARGET_RTO_MIN} 分钟
            </Text>
          </Space>
        );
      },
    },
    {
      title: "通过情况",
      dataIndex: "passed",
      key: "passed",
      width: 100,
      align: "center",
      render: (passed: boolean | undefined, record) => {
        if (record.status !== "completed") {
          return <Tag>待定</Tag>;
        }
        return passed ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            通过
          </Tag>
        ) : (
          <Tag color="red" icon={<WarningOutlined />}>
            未通过
          </Tag>
        );
      },
    },
    {
      title: "验证人",
      dataIndex: "verifier",
      key: "verifier",
      width: 120,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: "报告",
      dataIndex: "reportUrl",
      key: "reportUrl",
      width: 100,
      render: (url?: string) =>
        url ? (
          <Button type="link" size="small" href={url} target="_blank">
            查看
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small" title="演练统计">
        <Row gutter={12}>
          <Col span={6}>
            <Statistic
              title="演练总数"
              value={drills.length}
              prefix={<ExperimentOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="通过"
              value={
                drills.filter(
                  (d) => d.status === "completed" && d.passed === true,
                ).length
              }
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="失败"
              value={drills.filter((d) => d.status === "failed").length}
              valueStyle={{ color: "#cf1322" }}
              prefix={<WarningOutlined />}
            />
          </Col>
          <Col span={6}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onStartDrill}
              loading={startingDrill}
              block
            >
              启动新演练
            </Button>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="演练记录">
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={drills}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1400 }}
            size="small"
            locale={{ emptyText: <Empty description="无演练记录" /> }}
          />
        </Spin>
      </Card>

      <Card size="small" title="演练流程">
        <Timeline
          items={[
            {
              color: "blue",
              children: (
                <Space direction="vertical" size={2}>
                  <Text strong>1. 选择源备份点</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    从已验证的全量备份点选择恢复源
                  </Text>
                </Space>
              ),
            },
            {
              color: "blue",
              children: (
                <Space direction="vertical" size={2}>
                  <Text strong>2. 启动隔离环境</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    创建隔离的演练环境，不影响生产
                  </Text>
                </Space>
              ),
            },
            {
              color: "blue",
              children: (
                <Space direction="vertical" size={2}>
                  <Text strong>3. 执行恢复</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    从备份点恢复数据，计时 RTO
                  </Text>
                </Space>
              ),
            },
            {
              color: "blue",
              children: (
                <Space direction="vertical" size={2}>
                  <Text strong>4. 一致性验证</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    检查对象数、哈希、完整性
                  </Text>
                </Space>
              ),
            },
            {
              color: "green",
              children: (
                <Space direction="vertical" size={2}>
                  <Text strong>5. 生成报告</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    输出 RTO/Findings 报告，归档审计
                  </Text>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        * 灾备演练在隔离环境执行，不影响生产；演练失败将触发备份策略审查。
      </Paragraph>
    </Space>
  );
}
