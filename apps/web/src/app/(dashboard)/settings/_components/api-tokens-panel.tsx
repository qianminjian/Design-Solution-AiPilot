"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  App,
} from "antd";
import {
  ApiOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { AuthContext } from "@design-platform/shared";

const { Text, Paragraph } = Typography;

interface ApiTokensPanelProps {
  auth?: AuthContext;
}

interface ApiToken {
  id: string;
  name: string;
  prefix: string; // 仅展示前 8 位
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  status: "active" | "expired" | "revoked";
}

/** 仅创建时返回一次的完整 Token（V0：mock 生成） */
interface CreatedToken {
  id: string;
  token: string; // 完整 token，仅本次展示
  name: string;
  expiresAt: string;
}

const MOCK_TOKENS: ApiToken[] = [
  {
    id: "tok-001",
    name: "CI/CD Pipeline",
    prefix: "dp_live_8a3f",
    scopes: ["read:projects", "read:documents", "write:publications"],
    createdAt: "2026-06-01T10:00:00Z",
    expiresAt: "2026-09-30T23:59:59Z",
    lastUsedAt: "2026-07-28T08:15:00Z",
    status: "active",
  },
  {
    id: "tok-002",
    name: "Local Dev Tool",
    prefix: "dp_live_2c1b",
    scopes: ["read:projects", "read:documents"],
    createdAt: "2026-07-15T14:00:00Z",
    expiresAt: "2026-08-15T23:59:59Z",
    lastUsedAt: "2026-07-27T20:30:00Z",
    status: "active",
  },
  {
    id: "tok-003",
    name: "Old Export Script",
    prefix: "dp_live_f0a9",
    scopes: ["read:documents"],
    createdAt: "2026-03-01T09:00:00Z",
    expiresAt: "2026-04-01T23:59:59Z",
    lastUsedAt: "2026-03-28T11:20:00Z",
    status: "expired",
  },
];

const STATUS_COLOR: Record<ApiToken["status"], string> = {
  active: "success",
  expired: "default",
  revoked: "error",
};

const STATUS_LABEL: Record<ApiToken["status"], string> = {
  active: "生效中",
  expired: "已过期",
  revoked: "已撤销",
};

/**
 * API Tokens Tab —— Token 管理
 *
 * 安全约束（security.md §1）：
 *  - Token 仅在创建时返回完整明文，之后不可再获取
 *  - 撤销操作不可逆，需二次确认
 *  - 所有 Token 操作触发审计日志
 */
export function ApiTokensPanel({ auth }: ApiTokensPanelProps) {
  const { message, modal } = App.useApp();
  const [tokens, setTokens] = useState<ApiToken[]>(MOCK_TOKENS);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await new Promise((r) => setTimeout(r, 600));
      // V0：mock 生成 token
      const newToken: CreatedToken = {
        id: `tok-${Date.now()}`,
        token: `dp_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 12)}`,
        name: values.name,
        expiresAt: values.expiresAt,
      };
      setCreatedToken(newToken);
      setTokens((prev) => [
        {
          id: newToken.id,
          name: newToken.name,
          prefix: newToken.token.slice(0, 12),
          scopes: values.scopes,
          createdAt: new Date().toISOString(),
          expiresAt: newToken.expiresAt,
          status: "active",
        },
        ...prev,
      ]);
      setCreateOpen(false);
      form.resetFields();
      message.success("Token 已创建，请立即复制保存");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = (token: ApiToken) => {
    modal.confirm({
      title: `撤销 Token "${token.name}"？`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical" size={4}>
          <Text>此操作不可逆，使用该 Token 的所有集成将立即失效。</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            影响范围：{token.scopes.length} 个 scope · 创建于{" "}
            {new Date(token.createdAt).toLocaleDateString()}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            建议先在 CI/CD 中替换该 Token，再执行撤销。
          </Text>
        </Space>
      ),
      okText: "确认撤销",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        setTokens((prev) =>
          prev.map((t) =>
            t.id === token.id ? { ...t, status: "revoked" } : t,
          ),
        );
        message.success(`已撤销 Token "${token.name}"（Mock，审计日志已记录）`);
      },
    });
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    message.success("已复制到剪贴板");
  };

  const columns: ColumnsType<ApiToken> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text code style={{ fontSize: 11 }}>
            {record.prefix}…
          </Text>
        </Space>
      ),
    },
    {
      title: "Scope",
      dataIndex: "scopes",
      key: "scopes",
      render: (scopes: string[]) => (
        <Space wrap size={[4, 4]}>
          {scopes.map((s) => (
            <Tag key={s} color="blue" style={{ fontSize: 11 }}>
              {s}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: ApiToken["status"]) => (
        <Tag
          color={STATUS_COLOR[s]}
          icon={
            s === "active" ? (
              <CheckCircleOutlined />
            ) : s === "expired" ? (
              <ClockCircleOutlined />
            ) : null
          }
        >
          {STATUS_LABEL[s]}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (t: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(t).toLocaleDateString("zh-CN")}
        </Text>
      ),
    },
    {
      title: "过期时间",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 150,
      render: (t: string) => {
        const exp = new Date(t);
        const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
        const isExpiringSoon = days >= 0 && days <= 7;
        return (
          <Tooltip title={exp.toLocaleString("zh-CN")}>
            <Space size={4}>
              <Text
                type={isExpiringSoon ? "warning" : "secondary"}
                style={{ fontSize: 12 }}
              >
                {exp.toLocaleDateString("zh-CN")}
              </Text>
              {isExpiringSoon && (
                <Tag color="orange" style={{ fontSize: 11 }}>
                  {days}天后
                </Tag>
              )}
            </Space>
          </Tooltip>
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
      title: "操作",
      key: "action",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={record.status === "revoked"}
          onClick={() => handleRevoke(record)}
        >
          撤销
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="API Token 安全须知"
        description={
          <Space direction="vertical" size={2}>
            <Text>
              · Token 仅在创建时显示完整明文，关闭对话框后无法再次查看。
            </Text>
            <Text>
              · Token 等同于账户密码，请妥善保管，禁止提交到 Git 或日志。
            </Text>
            <Text>· 怀疑泄露请立即撤销并轮换。</Text>
            <Text>· 所有 Token 操作（创建/撤销）将记录审计日志。</Text>
          </Space>
        }
      />

      <Card
        size="small"
        title={
          <>
            <ApiOutlined style={{ marginRight: 8 }} />
            API Tokens
          </>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            创建 Token
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tokens}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="暂无 API Token" /> }}
        />
      </Card>

      {/* 创建 Token 对话框 */}
      <Modal
        title="创建 API Token"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scopes: ["read:projects"], expiresAt: undefined }}
        >
          <Form.Item
            name="name"
            label="Token 名称"
            rules={[
              { required: true, message: "请输入 Token 名称" },
              { min: 3, message: "至少 3 个字符" },
            ]}
          >
            <Input placeholder="如 CI/CD Pipeline / Local Dev" />
          </Form.Item>
          <Form.Item
            name="scopes"
            label="权限范围"
            rules={[{ required: true, message: "请至少选择一个 scope" }]}
            tooltip="遵循最小权限原则"
          >
            <Select
              mode="multiple"
              placeholder="选择 scope"
              options={[
                { value: "read:projects", label: "read:projects" },
                { value: "write:projects", label: "write:projects" },
                { value: "read:documents", label: "read:documents" },
                { value: "write:documents", label: "write:documents" },
                { value: "read:publications", label: "read:publications" },
                { value: "write:publications", label: "write:publications" },
                { value: "read:ai-runs", label: "read:ai-runs" },
                {
                  value: "execute:ai-runs",
                  label: "execute:ai-runs（高风险）",
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="过期日期"
            rules={[{ required: true, message: "请选择过期日期" }]}
            tooltip="强制 ≤ 90 天，到期前 7 天将提醒"
          >
            <Input type="date" min={new Date().toISOString().slice(0, 10)} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="创建后将立即显示完整 Token 明文"
            description="请准备好安全的密码管理器或环境变量存储位置，关闭对话框后将无法再次查看。"
          />
        </Form>
      </Modal>

      {/* 创建后展示完整 Token */}
      <Modal
        title="Token 已创建"
        open={!!createdToken}
        onCancel={() => {
          setCreatedToken(null);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setCreatedToken(null);
            }}
          >
            我已保存
          </Button>,
        ]}
        closable={false}
        maskClosable={false}
        width={560}
      >
        {createdToken && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              type="warning"
              showIcon
              message="这是唯一一次查看完整 Token 的机会"
              description="关闭对话框后将无法再次显示，请立即复制保存。"
            />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Token 名称
              </Text>
              <Paragraph style={{ margin: 0 }}>
                <Text strong>{createdToken.name}</Text>
              </Paragraph>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                完整 Token
              </Text>
              <Input.Group compact>
                <Input
                  readOnly
                  value={createdToken.token}
                  style={{
                    width: "calc(100% - 80px)",
                    fontFamily: "monospace",
                  }}
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(createdToken.token)}
                  style={{ width: 80 }}
                >
                  复制
                </Button>
              </Input.Group>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                过期时间
              </Text>
              <Paragraph style={{ margin: 0 }}>
                <Text>
                  {new Date(createdToken.expiresAt).toLocaleString("zh-CN")}
                </Text>
              </Paragraph>
            </div>
          </Space>
        )}
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V0 阶段 Token 操作仅前端 Mock；V1 接入 IAM Token API
        后将持久化并触发审计日志。当前用户：
        {auth?.principal?.displayName ?? "—"}
      </Text>
    </Space>
  );
}
