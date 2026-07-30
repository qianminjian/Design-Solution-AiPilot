"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  TeamOutlined,
  SearchOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { GovernanceAccessGrant } from "@design-platform/shared";
import { AccessGrantDetailDrawer } from "./_components/grant-detail-drawer";
import { RevokeGrantModal } from "./_components/revoke-grant-modal";
import { useAccessGrants, useAccessGrantAction } from "@/hooks/use-governance";

const { Title, Text } = Typography;

type GrantType = "all" | "member" | "external" | "service" | "breakglass";
type RiskFilter = "all" | "low" | "medium" | "high" | "critical";

/**
 * Access Review 页面（D37.17 治理中心）
 *
 * 路由：/governance/access-review
 *
 * 首屏组成：
 *  - 4 个状态卡片（待审/即将过期/高风险/break-glass）
 *  - 筛选栏（类型/风险/Owner）
 *  - Grant 表格
 *  - 详情 Drawer（右侧）
 *  - 撤销/缩短 Modal（含影响预览 + Step-up）
 *
 * 数据来源：BFF GovernanceProxyController → Core Service AccessGrantController
 */
export default function AccessReviewPage() {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<GrantType>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedGrant, setSelectedGrant] =
    useState<GovernanceAccessGrant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] =
    useState<GovernanceAccessGrant | null>(null);

  // 列表查询：服务端按 type/riskLevel 过滤，客户端按 keyword 过滤
  const { data: grantsData, isLoading } = useAccessGrants({
    page: 1,
    pageSize: 100,
    type: typeFilter === "all" ? undefined : typeFilter,
    riskLevel: riskFilter === "all" ? undefined : riskFilter,
  });

  // 写操作 mutation：approve / shorten / revoke
  const actionMutation = useAccessGrantAction();

  const grants = grantsData?.list ?? [];

  // 统计汇总
  const summary = useMemo(() => {
    const pending = grants.filter((g) => g.status === "pending_review").length;
    const expiringSoon = grants.filter((g) => {
      const days = Math.ceil(
        (new Date(g.expiresAt).getTime() - Date.now()) / 86_400_000,
      );
      return days >= 0 && days <= 7;
    }).length;
    const highRisk = grants.filter(
      (g) => g.riskLevel === "high" || g.riskLevel === "critical",
    ).length;
    const breakGlass = grants.filter((g) => g.type === "breakglass").length;
    return { pending, expiringSoon, highRisk, breakGlass };
  }, [grants]);

  // 客户端关键字过滤（服务端不支持 keyword 模糊搜索）
  const filtered = useMemo(() => {
    if (!keyword) return grants;
    const k = keyword.toLowerCase();
    return grants.filter(
      (g) =>
        g.principalName.toLowerCase().includes(k) ||
        g.principalEmail.toLowerCase().includes(k) ||
        g.resource.toLowerCase().includes(k) ||
        g.owner.toLowerCase().includes(k),
    );
  }, [grants, keyword]);

  const handleRevoke = (grant: GovernanceAccessGrant) => {
    setRevokeTarget(grant);
  };

  const confirmRevoke = (grant: GovernanceAccessGrant) => {
    actionMutation.mutate(
      {
        id: grant.id,
        payload: {
          action: "revoke",
          reason: "Manual revoke from Access Review console",
          // V0：以确认短语充当 stepUpToken；V1 接入 IAM 后替换为真实 MFA
          stepUpToken: grant.requiresStepUp ? "REVOKE" : undefined,
        },
      },
      {
        onSuccess: () => {
          message.success(`Grant ${grant.id} 已撤销`);
          setRevokeTarget(null);
          if (selectedGrant?.id === grant.id) {
            setSelectedGrant(null);
            setDrawerOpen(false);
          }
        },
        onError: (err) => {
          message.error(`撤销失败：${err.message}`);
        },
      },
    );
  };

  const handleShorten = (grant: GovernanceAccessGrant) => {
    // V0：缩短到期时间为 24 小时后
    const newExpiry = new Date(Date.now() + 86_400_000).toISOString();
    actionMutation.mutate(
      {
        id: grant.id,
        payload: {
          action: "shorten",
          reason: "Manual shorten to 24h from Access Review console",
          newExpiresAt: newExpiry,
          stepUpToken: grant.requiresStepUp ? "SHORTEN" : undefined,
        },
      },
      {
        onSuccess: () => {
          message.success(`Grant ${grant.id} 已缩短至 24h 后到期`);
          if (selectedGrant?.id === grant.id) {
            setSelectedGrant({
              ...grant,
              expiresAt: newExpiry,
              status: "shortened",
            });
          }
        },
        onError: (err) => {
          message.error(`缩短失败：${err.message}`);
        },
      },
    );
  };

  const columns: ColumnsType<GovernanceAccessGrant> = [
    {
      title: "Principal",
      dataIndex: "principalName",
      key: "principalName",
      width: 200,
      fixed: "left",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.principalName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.principalEmail}
          </Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (t: GovernanceAccessGrant["type"]) => {
        const colorMap: Record<GovernanceAccessGrant["type"], string> = {
          member: "blue",
          external: "purple",
          service: "geekblue",
          breakglass: "red",
        };
        const labelMap: Record<GovernanceAccessGrant["type"], string> = {
          member: "成员",
          external: "外部",
          service: "服务",
          breakglass: "Break-Glass",
        };
        return <Tag color={colorMap[t]}>{labelMap[t]}</Tag>;
      },
    },
    {
      title: "资源",
      dataIndex: "resource",
      key: "resource",
      width: 200,
      ellipsis: true,
      render: (r: string, record) => (
        <Tooltip title={`${r} · ${record.permission}`}>
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{r}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.permission}
            </Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "风险",
      dataIndex: "riskLevel",
      key: "riskLevel",
      width: 90,
      render: (r: GovernanceAccessGrant["riskLevel"]) => {
        const colorMap: Record<GovernanceAccessGrant["riskLevel"], string> = {
          low: "default",
          medium: "blue",
          high: "orange",
          critical: "red",
        };
        const labelMap: Record<GovernanceAccessGrant["riskLevel"], string> = {
          low: "低",
          medium: "中",
          high: "高",
          critical: "严重",
        };
        return <Tag color={colorMap[r]}>{labelMap[r]}</Tag>;
      },
    },
    {
      title: "到期",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 140,
      render: (t: string, record) => {
        if (record.status === "revoked") {
          return <Tag color="default">已撤销</Tag>;
        }
        const exp = new Date(t);
        const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
        if (days < 0) return <Tag color="default">已过期</Tag>;
        if (days <= 7) {
          return (
            <Tooltip title={exp.toLocaleString("zh-CN")}>
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                {days}天后
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {exp.toLocaleDateString("zh-CN")}
          </Text>
        );
      },
    },
    {
      title: "最后使用",
      dataIndex: "lastUsedAt",
      key: "lastUsedAt",
      width: 150,
      render: (t?: string) =>
        t ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(t).toLocaleString("zh-CN")}
          </Text>
        ) : (
          <Text type="secondary">从未</Text>
        ),
    },
    {
      title: "Owner",
      dataIndex: "owner",
      key: "owner",
      width: 120,
      render: (o: string) => <Text type="secondary">{o}</Text>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: GovernanceAccessGrant["status"]) => {
        const colorMap: Record<GovernanceAccessGrant["status"], string> = {
          active: "success",
          pending_review: "warning",
          shortened: "blue",
          revoked: "default",
          expired: "default",
        };
        const labelMap: Record<GovernanceAccessGrant["status"], string> = {
          active: "生效中",
          pending_review: "待审",
          shortened: "已缩短",
          revoked: "已撤销",
          expired: "已过期",
        };
        return <Tag color={colorMap[s]}>{labelMap[s]}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedGrant(record);
              setDrawerOpen(true);
            }}
          >
            详情
          </Button>
          {record.status !== "revoked" && record.status !== "expired" && (
            <>
              <Button
                type="link"
                size="small"
                disabled={
                  record.status === "shortened" || actionMutation.isPending
                }
                onClick={() => handleShorten(record)}
              >
                缩短
              </Button>
              <Button
                type="link"
                size="small"
                danger
                disabled={actionMutation.isPending}
                onClick={() => handleRevoke(record)}
              >
                撤销
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card size="small">
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 8 }} />
            访问审查
          </Title>
          <Text type="secondary">
            Governance · Access Review（D37.17）· Grant / Member / External /
            Break-Glass · 危险动作需影响预览
          </Text>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="数据来源：Core Service AccessGrantController"
        description="通过 BFF GovernanceProxyController 透传查询与写操作。撤销/缩短操作将记录审计日志，撤权传播水位按依赖拓扑异步生效。"
      />

      {/* 状态卡片 */}
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="待审 Grant"
              value={summary.pending}
              prefix={<ClockCircleOutlined style={{ color: "#fa8c16" }} />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="7 天内到期"
              value={summary.expiringSoon}
              prefix={<ClockCircleOutlined style={{ color: "#fa541c" }} />}
              valueStyle={{ color: "#fa541c" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="高风险 Grant"
              value={summary.highRisk}
              prefix={
                <ExclamationCircleOutlined style={{ color: "#cf1322" }} />
              }
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="Break-Glass 使用"
              value={summary.breakGlass}
              prefix={<KeyOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card size="small">
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索 Principal / 资源 / Owner"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
          />
          <Segmented
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as GrantType)}
            options={[
              { label: "全部", value: "all" },
              { label: "成员", value: "member" },
              { label: "外部", value: "external" },
              { label: "服务", value: "service" },
              { label: "Break-Glass", value: "breakglass" },
            ]}
          />
          <Select
            value={riskFilter}
            onChange={(v) => setRiskFilter(v as RiskFilter)}
            style={{ width: 140 }}
            options={[
              { value: "all", label: "全部风险" },
              { value: "low", label: "低风险" },
              { value: "medium", label: "中风险" },
              { value: "high", label: "高风险" },
              { value: "critical", label: "严重风险" },
            ]}
          />
          <Button icon={<ExportOutlined />} disabled>
            导出审查报告
          </Button>
        </Space>
      </Card>

      {/* Grant 表格 */}
      <Card size="small">
        <Spin spinning={isLoading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1400 }}
            locale={{ emptyText: <Empty description="无符合条件的 Grant" /> }}
          />
        </Spin>
      </Card>

      {/* 详情抽屉 */}
      <AccessGrantDetailDrawer
        grant={selectedGrant}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedGrant(null);
        }}
        onRevoke={(g) => {
          setDrawerOpen(false);
          setSelectedGrant(null);
          handleRevoke(g);
        }}
        onShorten={(g) => {
          handleShorten(g);
        }}
      />

      {/* 撤销 Modal（影响预览 + Step-up） */}
      <RevokeGrantModal
        grant={revokeTarget}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
      />

      <Text type="secondary" style={{ fontSize: 12 }}>
        <TeamOutlined style={{ marginRight: 4 }} />
        所有撤销/缩短操作通过 Core Service 写入审计日志；Step-up 认证 V0
        阶段以确认短语代替，V1 接入 IAM 后将走 MFA 流程。
      </Text>
    </Space>
  );
}
