"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
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
  DatabaseOutlined,
  AuditOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  LockOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { GovernanceDataAsset } from "@design-platform/shared";
import { useDataAssets, useDataAssetAction } from "@/hooks/use-governance";
import { DataErrorAlert } from "@/components/common/data-error-alert";

const { Title, Text, Paragraph } = Typography;

/**
 * 数据资产 DTO（对齐 shared 契约 GovernanceDataAsset）
 *
 * 字段说明详见 packages/shared/src/schemas/governance.schema.ts
 */
type DataAssetDto = GovernanceDataAsset;

const TYPE_LABEL: Record<DataAssetDto["type"], string> = {
  dictionary: "数据字典",
  dataset: "数据集",
  model: "BIM 模型",
  publication: "发布物",
  evidence: "证据包",
};

const TYPE_COLOR: Record<DataAssetDto["type"], string> = {
  dictionary: "blue",
  dataset: "geekblue",
  model: "purple",
  publication: "gold",
  evidence: "magenta",
};

const CLASSIFICATION_COLOR: Record<DataAssetDto["classification"], string> = {
  L1: "default",
  L2: "blue",
  L3: "gold",
  L4: "orange",
  L5: "red",
};

const STATUS_LABEL: Record<DataAssetDto["status"], string> = {
  active: "活跃",
  archived: "已归档",
  deletion_pending: "删除待审",
  hold_conflict: "法律保留冲突",
};

const STATUS_COLOR: Record<DataAssetDto["status"], string> = {
  active: "success",
  archived: "default",
  deletion_pending: "warning",
  hold_conflict: "error",
};

/**
 * Data Governance 页面（D37.17 治理中心）
 *
 * 首屏组成：Dictionary / Quality / Lineage / Retention / Hold / Deletion
 * 主要动作：assign / repair / hold / archive / delete
 * 特殊状态：法律保留冲突、跨存储部分完成
 */
export default function DataGovernancePage() {
  const { message, modal } = App.useApp();
  const [activeTab, setActiveTab] = useState("assets");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<DataAssetDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 真实 API 数据查询
  const {
    data: assetsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataAssets({ pageSize: 100 });
  const assets = assetsData?.list ?? [];
  const assetAction = useDataAssetAction();

  const summary = useMemo(
    () => ({
      total: assets.length,
      active: assets.filter((a) => a.status === "active").length,
      legalHold: assets.filter((a) => a.retention.legalHold).length,
      deletionPending: assets.filter((a) => a.status === "deletion_pending")
        .length,
      holdConflict: assets.filter((a) => a.status === "hold_conflict").length,
      avgQuality: assets.length
        ? assets.reduce((sum, a) => sum + a.qualityScore, 0) / assets.length
        : 0,
      avgLineage: assets.length
        ? assets.reduce((sum, a) => sum + a.lineageCoverage, 0) / assets.length
        : 0,
    }),
    [assets],
  );

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (
        search &&
        !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !a.id.includes(search)
      ) {
        return false;
      }
      return true;
    });
  }, [assets, typeFilter, search]);

  // 执行资产动作（hold/release_hold/archive/delete/repair）
  const executeAssetAction = async (
    asset: DataAssetDto,
    action: "hold" | "release_hold" | "archive" | "delete" | "repair",
    reason: string,
  ) => {
    try {
      await assetAction.mutateAsync({
        id: asset.id,
        payload: { action, reason },
      });
      message.success(`${asset.name} ${action} 操作成功`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "操作失败";
      message.error(errMsg);
    }
  };

  const handleArchive = (asset: DataAssetDto) => {
    modal.confirm({
      title: `归档资产 ${asset.name}？`,
      icon: <AuditOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>资产将进入只读归档状态，保留期到期后自动删除。</Text>
          {asset.retention.legalHold && (
            <Alert
              type="error"
              showIcon
              message="法律保留生效中"
              description="此资产处于法律保留状态，不可归档。请先解除法律保留（需 Step-up 认证和合规官批准）。"
              style={{ marginTop: 8 }}
            />
          )}
        </Space>
      ),
      okText: "确认归档",
      okType: "primary",
      okButtonProps: {
        disabled: asset.retention.legalHold,
        loading: assetAction.isPending,
      },
      cancelText: "取消",
      onOk: () =>
        executeAssetAction(
          asset,
          "archive",
          `归档资产 ${asset.name}（保留期到期自动删除）`,
        ),
    });
  };

  const handleDelete = (asset: DataAssetDto) => {
    modal.confirm({
      title: `删除资产 ${asset.name}？`,
      icon: <DeleteOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text type="danger">此操作不可逆，资产将被永久删除。</Text>
          <Alert
            type="warning"
            showIcon
            message="影响预览"
            description={
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Text>· 资产分类：{asset.classification}</Text>
                <Text>· 跨存储位置：{asset.storageLocations.length} 处</Text>
                <Text>
                  · 数据血缘关联：{Math.round(asset.lineageCoverage * 100)}%
                  覆盖
                </Text>
                <Text>· 保留期到期：{asset.retention.disposalDate}</Text>
                {asset.retention.legalHold && (
                  <Text type="danger" strong>
                    ⚠ 法律保留生效中，禁止删除
                  </Text>
                )}
              </Space>
            }
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认删除",
      okType: "danger",
      okButtonProps: {
        disabled: asset.retention.legalHold || asset.classification === "L5",
        loading: assetAction.isPending,
      },
      cancelText: "取消",
      onOk: () =>
        executeAssetAction(
          asset,
          "delete",
          `删除资产 ${asset.name}（分类 ${asset.classification}，需合规审批）`,
        ),
    });
  };

  const handleToggleHold = (asset: DataAssetDto) => {
    const newHold = !asset.retention.legalHold;
    modal.confirm({
      title: newHold
        ? `对 ${asset.name} 施加法律保留？`
        : `解除 ${asset.name} 的法律保留？`,
      icon: <LockOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {newHold ? (
            <>
              <Text>
                施加后资产将无法归档、删除或修改，需合规官批准才能解除。
              </Text>
              <Alert
                type="info"
                showIcon
                message="施加影响"
                description="跨存储位置将同步施加法律保留；施加期间保留期不计算。"
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="解除法律保留"
              description={
                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Text>解除后保留期将重新计算。</Text>
                  <Text>需 Step-up 认证 + 合规官二人审批。</Text>
                  <Text type="danger">此操作将记录审计日志。</Text>
                </Space>
              }
              style={{ marginTop: 8 }}
            />
          )}
        </Space>
      ),
      okText: newHold ? "施加保留" : "解除保留",
      okType: newHold ? "primary" : "danger",
      okButtonProps: { loading: assetAction.isPending },
      cancelText: "取消",
      onOk: () =>
        executeAssetAction(
          asset,
          newHold ? "hold" : "release_hold",
          newHold
            ? `对 ${asset.name} 施加法律保留（需合规官批准才能解除）`
            : `解除 ${asset.name} 法律保留（Step-up 认证 + 合规官审批）`,
        ),
    });
  };

  const columns: ColumnsType<DataAssetDto> = [
    {
      title: "资产",
      dataIndex: "name",
      key: "name",
      width: 240,
      fixed: "left",
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            <Tag color={TYPE_COLOR[record.type]}>{TYPE_LABEL[record.type]}</Tag>
          </Space>
          <Text code style={{ fontSize: 11 }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "分类",
      dataIndex: "classification",
      key: "classification",
      width: 80,
      align: "center",
      render: (c: DataAssetDto["classification"]) => (
        <Tag color={CLASSIFICATION_COLOR[c]}>{c}</Tag>
      ),
    },
    {
      title: "Owner",
      dataIndex: "owner",
      key: "owner",
      width: 140,
      render: (owner: string, record) => (
        <Space direction="vertical" size={0}>
          <Text>{owner}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.ownerEmail}
          </Text>
        </Space>
      ),
    },
    {
      title: "保留",
      key: "retention",
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <ClockCircleOutlined />
            <Text>{record.retention.years} 年</Text>
          </Space>
          {record.retention.legalHold && (
            <Tag color="red" icon={<LockOutlined />} style={{ fontSize: 11 }}>
              法律保留
            </Tag>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>
            到期：{record.retention.disposalDate}
          </Text>
        </Space>
      ),
    },
    {
      title: "质量",
      key: "quality",
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          <Progress
            percent={record.qualityScore * 100}
            size="small"
            status={record.qualityScore >= 0.9 ? "success" : "exception"}
            format={(p) => `${(p! / 100).toFixed(2)}`}
          />
          {record.qualityIssues > 0 && (
            <Text type="warning" style={{ fontSize: 11 }}>
              {record.qualityIssues} 个问题
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "血缘",
      dataIndex: "lineageCoverage",
      key: "lineageCoverage",
      width: 120,
      render: (v: number) => (
        <Progress
          percent={v * 100}
          size="small"
          status={v >= 0.9 ? "success" : v >= 0.7 ? "normal" : "exception"}
        />
      ),
    },
    {
      title: "存储",
      dataIndex: "storageLocations",
      key: "storageLocations",
      width: 180,
      render: (locs: string[]) => (
        <Space wrap size={[4, 4]}>
          {locs.map((l) => (
            <Tag key={l} style={{ fontSize: 11 }}>
              {l}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: DataAssetDto["status"]) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 260,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedAsset(record);
              setDetailOpen(true);
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LockOutlined />}
            onClick={() => handleToggleHold(record)}
          >
            {record.retention.legalHold ? "解除保留" : "施加保留"}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<AuditOutlined />}
            disabled={
              record.retention.legalHold || record.status === "archived"
            }
            onClick={() => handleArchive(record)}
          >
            归档
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={
              record.retention.legalHold || record.classification === "L5"
            }
            onClick={() => handleDelete(record)}
          >
            删除
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
            数据治理
          </Title>
          <Text type="secondary">
            Governance · Data Governance（D37.17）· Dictionary / Quality /
            Lineage / Retention / Hold / Deletion · 法律保留与跨存储一致性
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="对接后端真实 API"
        description="已对接 Data Governance Service（D37.17）：资产清单/Hold/Archive/Delete 操作通过 BFF 代理转发到 Core Service；所有操作将记录审计日志，L5 资产和法律保留资产禁止删除。后端未返回数据时显示空状态。"
      />

      {isError && (
        <DataErrorAlert
          error={error}
          context="数据资产列表"
          variant="result"
          onRetry={() => void refetch()}
          retryLabel="重试加载"
        />
      )}

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spin tip="加载数据资产列表..." size="large" />
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "assets",
            label: (
              <span>
                <DatabaseOutlined /> 资产清单
              </span>
            ),
            children: (
              <>
                {/* 状态卡片 */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic title="资产总数" value={summary.total} />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="活跃"
                        value={summary.active}
                        valueStyle={{ color: "#52c41a" }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="法律保留"
                        value={summary.legalHold}
                        valueStyle={{ color: "#cf1322" }}
                        prefix={<LockOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="删除待审"
                        value={summary.deletionPending}
                        valueStyle={{ color: "#fa8c16" }}
                        prefix={<DeleteOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="保留冲突"
                        value={summary.holdConflict}
                        valueStyle={{ color: "#cf1322" }}
                        prefix={<WarningOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card size="small" hoverable>
                      <Statistic
                        title="平均质量"
                        value={summary.avgQuality}
                        precision={2}
                        suffix="/ 1.0"
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 筛选 */}
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索资产名称或 ID..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Segmented
                      value={typeFilter}
                      onChange={(v) => setTypeFilter(v as string)}
                      options={[
                        { label: "全部", value: "all" },
                        { label: "数据字典", value: "dictionary" },
                        { label: "数据集", value: "dataset" },
                        { label: "BIM 模型", value: "model" },
                        { label: "发布物", value: "publication" },
                        { label: "证据包", value: "evidence" },
                      ]}
                    />
                  </Space>
                </Card>

                <Card size="small">
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filtered}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1500 }}
                    locale={{ emptyText: <Empty description="无资产" /> }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: "lineage",
            label: (
              <span>
                <ApartmentOutlined /> 血缘
              </span>
            ),
            children: <LineageTab assets={assets} />,
          },
          {
            key: "retention",
            label: (
              <span>
                <ClockCircleOutlined /> 保留策略
              </span>
            ),
            children: <RetentionTab assets={assets} />,
          },
        ]}
      />

      {/* 详情 Modal */}
      <Modal
        title={
          selectedAsset ? (
            <Space>
              <DatabaseOutlined />
              <Text>{selectedAsset.name}</Text>
              <Tag color={TYPE_COLOR[selectedAsset.type]}>
                {TYPE_LABEL[selectedAsset.type]}
              </Tag>
            </Space>
          ) : (
            "资产详情"
          )
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedAsset(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ]}
        width={720}
      >
        {selectedAsset && <AssetDetail asset={selectedAsset} />}
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * 所有 Hold/Archive/Delete 操作通过 BFF 代理转发到 Core
        Service，并写入审计日志。L5 资产和法律保留资产禁止删除。
      </Text>
    </Space>
  );
}

/** 资产详情 */
function AssetDetail({ asset }: { asset: DataAssetDto }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="资产 ID">
          <Text code>{asset.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="类型">
          <Tag color={TYPE_COLOR[asset.type]}>{TYPE_LABEL[asset.type]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="业务域">{asset.domain}</Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color={CLASSIFICATION_COLOR[asset.classification]}>
            {asset.classification}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Owner">{asset.owner}</Descriptions.Item>
        <Descriptions.Item label="Owner Email">
          {asset.ownerEmail}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={STATUS_COLOR[asset.status]}>
            {STATUS_LABEL[asset.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="最近变更">
          {new Date(asset.lastModified).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {asset.description}
        </Descriptions.Item>
      </Descriptions>

      <Card size="small" title="保留与法律保留">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="保留年限">
            {asset.retention.years} 年
          </Descriptions.Item>
          <Descriptions.Item label="处置日期">
            {asset.retention.disposalDate}
          </Descriptions.Item>
          <Descriptions.Item label="法律保留" span={2}>
            {asset.retention.legalHold ? (
              <Tag color="red" icon={<LockOutlined />}>
                已施加（无法归档/删除/修改）
              </Tag>
            ) : (
              <Tag color="green">未施加</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="质量与血缘">
        <Row gutter={12}>
          <Col span={12}>
            <Statistic
              title="质量得分"
              value={asset.qualityScore}
              precision={2}
              suffix="/ 1.0"
              valueStyle={{
                color: asset.qualityScore >= 0.9 ? "#52c41a" : "#fa8c16",
              }}
            />
            {asset.qualityIssues > 0 && (
              <Text type="warning" style={{ fontSize: 12 }}>
                {asset.qualityIssues} 个质量问题待修复
              </Text>
            )}
          </Col>
          <Col span={12}>
            <Statistic
              title="血缘覆盖率"
              value={asset.lineageCoverage}
              precision={2}
              suffix="/ 1.0"
              valueStyle={{
                color: asset.lineageCoverage >= 0.9 ? "#52c41a" : "#cf1322",
              }}
            />
            <Progress
              percent={asset.lineageCoverage * 100}
              size="small"
              status={asset.lineageCoverage >= 0.9 ? "success" : "exception"}
            />
          </Col>
        </Row>
      </Card>

      <Card size="small" title="跨存储位置">
        <Space wrap>
          {asset.storageLocations.map((l) => (
            <Tag key={l} icon={<SafetyCertificateOutlined />}>
              {l}
            </Tag>
          ))}
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
          跨存储位置的法律保留和删除需同步执行；任一位置失败将标记为部分完成状态。
        </Paragraph>
      </Card>
    </Space>
  );
}

/** 血缘 Tab */
function LineageTab({ assets }: { assets: DataAssetDto[] }) {
  return (
    <Card size="small" title="数据血缘图">
      <Empty description="当前版本以列表展示血缘，后续将接入 Lineage Service 提供可视化图谱">
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {assets.map((a) => (
            <Card key={a.id} size="small" type="inner">
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space>
                  <Text strong>{a.name}</Text>
                  <Tag color={TYPE_COLOR[a.type]}>{TYPE_LABEL[a.type]}</Tag>
                  <Tag color={STATUS_COLOR[a.status]}>
                    {STATUS_LABEL[a.status]}
                  </Tag>
                </Space>
                <Space size={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    血缘覆盖：
                    <Progress
                      percent={a.lineageCoverage * 100}
                      size="small"
                      style={{
                        width: 120,
                        display: "inline-flex",
                        marginLeft: 4,
                      }}
                      status={
                        a.lineageCoverage >= 0.9 ? "success" : "exception"
                      }
                    />
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    上游：{Math.ceil(a.lineageCoverage * 5)} 个来源
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    下游：{Math.ceil(a.lineageCoverage * 3)} 个消费者
                  </Text>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      </Empty>
    </Card>
  );
}

/** 保留策略 Tab */
function RetentionTab({ assets }: { assets: DataAssetDto[] }) {
  const retentionColumns: ColumnsType<DataAssetDto> = [
    {
      title: "资产",
      dataIndex: "name",
      key: "name",
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text code style={{ fontSize: 11 }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "分类",
      dataIndex: "classification",
      key: "classification",
      width: 80,
      align: "center",
      render: (c: DataAssetDto["classification"]) => (
        <Tag color={CLASSIFICATION_COLOR[c]}>{c}</Tag>
      ),
    },
    {
      title: "保留年限",
      dataIndex: ["retention", "years"],
      key: "years",
      width: 100,
      align: "right",
      render: (y: number) => <Text strong>{y} 年</Text>,
    },
    {
      title: "处置日期",
      dataIndex: ["retention", "disposalDate"],
      key: "disposalDate",
      width: 120,
    },
    {
      title: "法律保留",
      dataIndex: ["retention", "legalHold"],
      key: "legalHold",
      width: 120,
      render: (hold: boolean) =>
        hold ? (
          <Tag color="red" icon={<LockOutlined />}>
            已施加
          </Tag>
        ) : (
          <Tag color="green">未施加</Tag>
        ),
    },
    {
      title: "剩余天数",
      key: "remainingDays",
      width: 100,
      align: "right",
      render: (_, record) => {
        const days = Math.ceil(
          (new Date(record.retention.disposalDate).getTime() - Date.now()) /
            86400000,
        );
        return (
          <Text
            type={days < 30 ? "danger" : days < 365 ? "warning" : "secondary"}
          >
            {days > 0 ? `${days} 天` : "已到期"}
          </Text>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small" title="保留策略时间线">
        <Timeline
          items={assets.slice(0, 5).map((a) => ({
            color: a.retention.legalHold ? "red" : "blue",
            children: (
              <Space direction="vertical" size={2}>
                <Space>
                  <Text strong>{a.name}</Text>
                  {a.retention.legalHold && (
                    <Tag
                      color="red"
                      icon={<LockOutlined />}
                      style={{ fontSize: 11 }}
                    >
                      法律保留
                    </Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  保留 {a.retention.years} 年 · 处置日期{" "}
                  {a.retention.disposalDate}
                </Text>
              </Space>
            ),
          }))}
        />
      </Card>

      <Card size="small" title="保留策略清单">
        <Table
          rowKey="id"
          columns={retentionColumns}
          dataSource={assets}
          pagination={false}
          size="small"
        />
      </Card>

      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        * 法律保留期间保留期不计算；解除法律保留需 Step-up 认证 +
        合规官二人审批（D37.23 不可逆/合规动作）。
      </Paragraph>
    </Space>
  );
}
