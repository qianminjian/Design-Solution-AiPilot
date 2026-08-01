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
  Skeleton,
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
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { AuthContext, ApiTokenDto } from "@design-platform/shared";
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from "@/hooks/use-iam";

const { Text, Paragraph } = Typography;

interface ApiTokensPanelProps {
  auth?: AuthContext;
}

/**
 * API Tokens Tab —— Token 管理（V1 接入 IAM Token API）
 *
 * 安全约束（security.md §1）：
 *  - Token 仅在创建时返回完整明文，关闭对话框后无法再次查看
 *  - 撤销操作不可逆，需二次确认
 *  - 所有 Token 操作触发审计日志
 *
 * V1 端点：
 *  - GET    /api/v1/iam/tokens        查询列表
 *  - POST   /api/v1/iam/tokens        创建新 Token（返回明文，仅本次）
 *  - DELETE /api/v1/iam/tokens/{id}   撤销 Token（软撤销）
 */
export function ApiTokensPanel({ auth }: ApiTokensPanelProps) {
  const { message, modal } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 数据查询
  const { data: tokens, isLoading, isError, error } = useApiTokens();
  const createMutation = useCreateApiToken();
  const revokeMutation = useRevokeApiToken();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      // 转换 expiresAt 为 ISO-8601（前端 date input 是 yyyy-mm-dd，附加 23:59:59Z 表示当天结束）
      const expiresAtIso = `${values.expiresAt}T23:59:59Z`;
      const response = await createMutation.mutateAsync({
        name: values.name,
        scopes: values.scopes,
        expiresAt: expiresAtIso,
      });
      // 显示明文 token（仅本次）
      setCreatedToken(response.plainToken);
      message.success("Token 创建成功，请立即复制保存");
      form.resetFields();
      setCreateOpen(false);
    } catch (err) {
      // mutation 失败或表单校验失败
      if (err instanceof Error && err.message) {
        message.error(err.message);
      } else if (createMutation.isError) {
        message.error("创建失败，请稍后重试");
      }
    }
  };

  const handleRevoke = (token: ApiTokenDto) => {
    modal.confirm({
      title: "确认撤销 Token",
      content: (
        <Space direction="vertical" size={4}>
          <Text>即将撤销 Token：{token.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            撤销操作不可逆，撤销后该 Token 立即失效。
          </Text>
        </Space>
      ),
      okText: "撤销",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await revokeMutation.mutateAsync({
            id: token.id,
            reason: "用户主动撤销",
          });
          message.success("Token 已撤销");
        } catch (err) {
          message.error(err instanceof Error ? err.message : "撤销失败");
        }
      },
    });
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      message.success("已复制到剪贴板");
    } catch {
      message.error("复制失败，请手动选择文本复制");
    }
  };

  const columns: ColumnsType<ApiTokenDto> = [
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
      render: (s: ApiTokenDto["status"]) => {
        const colorMap: Record<ApiTokenDto["status"], string> = {
          active: "success",
          expired: "default",
          revoked: "error",
        };
        const labelMap: Record<ApiTokenDto["status"], string> = {
          active: "生效中",
          expired: "已过期",
          revoked: "已撤销",
        };
        return <Tag color={colorMap[s]}>{labelMap[s]}</Tag>;
      },
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
      render: (t: string) => (
        <Tooltip title={new Date(t).toLocaleString("zh-CN")}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(t).toLocaleDateString("zh-CN")}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "最后使用",
      dataIndex: "lastUsedAt",
      key: "lastUsedAt",
      width: 150,
      render: (t: string | null) =>
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

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="加载 Token 列表失败"
        description={
          error instanceof Error
            ? `${error.message}（请检查网络或重新登录后重试）`
            : "未知错误，请稍后重试"
        }
      />
    );
  }

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
          <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建 Token
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tokens ?? []}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">暂无 API Token</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      点击右上角&ldquo;创建 Token&rdquo;创建首个 API Token
                    </Text>
                  </Space>
                }
              />
            ),
          }}
        />
      </Card>

      {/* 创建 Token 对话框 */}
      <Modal
        title="创建 API Token"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
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
              { max: 100, message: "不能超过 100 字符" },
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
        </Form>
      </Modal>

      {/* 明文 Token 展示对话框（创建成功后立即弹出，仅本次可复制） */}
      <Modal
        title="Token 创建成功"
        open={createdToken !== null}
        onCancel={() => {
          setCreatedToken(null);
        }}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => createdToken && handleCopyToken(createdToken)}
          >
            复制 Token
          </Button>,
          <Button
            key="close"
            type="primary"
            danger
            onClick={() => setCreatedToken(null)}
          >
            我已保存，关闭
          </Button>,
        ]}
        closable={false}
        maskClosable={false}
        width={620}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="这是 Token 的唯一一次明文展示"
            description="关闭对话框后将无法再次查看此 Token，请立即复制保存到安全的密钥管理器（如 1Password / Bitwarden）。"
          />
          <Paragraph
            code
            copyable={false}
            style={{
              wordBreak: "break-all",
              fontSize: 12,
              padding: 12,
              background: "#f5f5f5",
              border: "1px solid #d9d9d9",
              borderRadius: 4,
            }}
          >
            {createdToken ?? ""}
          </Paragraph>
        </Space>
      </Modal>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V1 已接入：Token 通过 POST /api/v1/iam/tokens
        创建，明文仅在创建响应中返回一次。 当前用户：
        {auth?.principal?.displayName ?? "—"}
      </Text>
    </Space>
  );
}
