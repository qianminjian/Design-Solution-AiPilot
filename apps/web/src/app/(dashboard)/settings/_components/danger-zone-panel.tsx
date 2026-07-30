"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  App,
} from "antd";
import {
  DeleteOutlined,
  LogoutOutlined,
  StopOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { AuthContext } from "@design-platform/shared";
import { useLogout } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const { Text } = Typography;

interface DangerZonePanelProps {
  auth?: AuthContext;
}

/**
 * Danger Zone Tab —— 危险动作（D37.17 治理中心对齐）
 *
 * 设计要求：
 *  - 危险动作必须打开影响预览
 *  - 显示租户/项目/资源数量、不可逆性、替代方案
 *  - 审批/Step-up 重新认证
 *  - 审计引用
 *
 * 包含 4 个动作：
 *  1. 撤销所有 API Token
 *  2. 退出所有会话（除当前设备）
 *  3. 清除本地草稿与缓存
 *  4. 注销账户（V1：需联系管理员，V0 仅展示流程）
 */
export function DangerZonePanel({ auth }: DangerZonePanelProps) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const logoutMutation = useLogout();
  const [confirmText, setConfirmText] = useState("");
  const [pendingAction, setPendingAction] = useState<
    | null
    | "revoke-tokens"
    | "sign-out-sessions"
    | "clear-local"
    | "delete-account"
  >(null);

  const principal = auth?.principal;

  // 影响预览数据（V0：Mock，V1 从后端聚合）
  const impactPreview = {
    activeTokens: 2,
    activeSessions: 3,
    localDrafts: 12,
    ownedProjects: 4,
    ownedDocuments: 28,
    pendingReviews: 6,
  };

  const handleRevokeAllTokens = () => {
    modal.confirm({
      title: "撤销所有 API Token？",
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message="不可逆操作"
            description="此操作将立即撤销你名下的所有有效 API Token，使用这些 Token 的 CI/CD 流水线、脚本和集成都将在数秒内失效。"
            style={{ marginTop: 8 }}
          />
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="将撤销 Token 数">
              <Tag color="red">{impactPreview.activeTokens} 个</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="替代方案">
              <Text type="secondary" style={{ fontSize: 12 }}>
                如怀疑单个 Token 泄露，请改在 API Tokens Tab 单独撤销该
                Token，避免影响其他集成。
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="审计">
              <Text type="secondary" style={{ fontSize: 12 }}>
                操作将记录到 Audit Log，包含
                actor/tenant/timestamp/affectedResources。
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      ),
      okText: "确认撤销全部",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        // V0：Mock 延迟
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            message.success("已撤销 2 个 Token（Mock，审计日志已记录）");
            resolve();
          }, 600);
        });
      },
    });
  };

  const handleSignOutAllSessions = async () => {
    setPendingAction("sign-out-sessions");
    try {
      // V0：Mock 仅退出当前会话
      await new Promise((r) => setTimeout(r, 600));
      message.success("已退出 2 个其他会话（Mock），当前会话保留");
    } finally {
      setPendingAction(null);
    }
  };

  const handleClearLocal = () => {
    modal.confirm({
      title: "清除本地草稿与缓存？",
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Text>将清除浏览器中保存的：</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            · {impactPreview.localDrafts} 个未提交草稿（评论、Issue 描述、表单）
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            · 已保存的列布局/筛选视图（不影响服务端 SavedView）
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            · 查询缓存与本地 IndexedDB 中的临时数据
          </Text>
          <Alert
            type="warning"
            showIcon
            message="不影响服务端数据"
            description="服务端保存的 SavedView、订阅、订阅设置不受影响；只清除浏览器本地数据。"
            style={{ marginTop: 8 }}
          />
        </Space>
      ),
      okText: "确认清除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          message.success("本地草稿与缓存已清除");
        } catch (err) {
          message.error(err instanceof Error ? err.message : "清除失败");
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    setPendingAction("delete-account");
    setConfirmText("");
  };

  const confirmDeleteAccount = async () => {
    if (confirmText !== "DELETE MY ACCOUNT") {
      message.error("请输入 DELETE MY ACCOUNT 以确认");
      return;
    }
    // V0：Mock 警告，V1 走 IAM Service
    setPendingAction(null);
    setConfirmText("");
    modal.warning({
      title: "账户注销需联系管理员",
      content: (
        <Space direction="vertical" size={4}>
          <Text>
            根据 D37.17
            治理要求，账户注销涉及数据保留与销毁合规义务，不可自助完成。
          </Text>
          <Text>请联系租户管理员或合规负责人，提交注销申请。</Text>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            影响资源：{impactPreview.ownedProjects} 个项目 ·{" "}
            {impactPreview.ownedDocuments} 个文档 ·{" "}
            {impactPreview.pendingReviews} 个待审任务
          </Text>
        </Space>
      ),
      okText: "知道了",
    });
  };

  const handleLogoutAll = async () => {
    try {
      await logoutMutation.mutateAsync();
      message.success("已退出登录");
      router.push("/login");
    } catch (error) {
      const tip =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "退出登录失败";
      message.error(tip);
    }
  };

  const actions = [
    {
      key: "revoke-tokens",
      icon: <StopOutlined />,
      title: "撤销所有 API Token",
      description: "立即作废你名下所有有效 Token，影响 CI/CD 与脚本集成。",
      impact: `${impactPreview.activeTokens} 个 Token · 不可逆`,
      button: (
        <Button danger icon={<StopOutlined />} onClick={handleRevokeAllTokens}>
          撤销全部
        </Button>
      ),
    },
    {
      key: "sign-out-sessions",
      icon: <LogoutOutlined />,
      title: "退出所有会话",
      description: "退出除当前浏览器外的所有会话（移动端、其他设备）。",
      impact: `${impactPreview.activeSessions} 个会话 · 可重新登录`,
      button: (
        <Button
          danger
          icon={<LogoutOutlined />}
          loading={pendingAction === "sign-out-sessions"}
          onClick={handleSignOutAllSessions}
        >
          退出会话
        </Button>
      ),
    },
    {
      key: "clear-local",
      icon: <DeleteOutlined />,
      title: "清除本地草稿与缓存",
      description: "清除浏览器中保存的未提交草稿、列布局和本地缓存。",
      impact: `${impactPreview.localDrafts} 个草稿 · 不影响服务端`,
      button: (
        <Button danger icon={<DeleteOutlined />} onClick={handleClearLocal}>
          清除本地
        </Button>
      ),
    },
    {
      key: "delete-account",
      icon: <WarningOutlined />,
      title: "注销账户",
      description: "永久注销账户并处置相关数据，涉及数据保留与销毁合规义务。",
      impact: `${impactPreview.ownedProjects} 个项目 · ${impactPreview.ownedDocuments} 个文档 · 不可逆`,
      button: (
        <Button
          danger
          type="primary"
          icon={<WarningOutlined />}
          onClick={handleDeleteAccount}
        >
          注销账户
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="error"
        showIcon
        message="危险区域（Danger Zone）"
        description={
          <Space direction="vertical" size={2}>
            <Text>根据 D37.17 治理中心规范，所有危险动作：</Text>
            <Text>· 必须打开影响预览，显示资源数量与不可逆性</Text>
            <Text>· 必须提供替代方案，避免误操作</Text>
            <Text>· 涉及账户级影响的需 Step-up 重新认证</Text>
            <Text>
              · 全部操作记录到 Audit Log，含 actor/timestamp/affectedResources
            </Text>
          </Space>
        }
      />

      {actions.map((action) => (
        <Card
          key={action.key}
          size="small"
          style={{ borderColor: "#ffa39e" }}
          headStyle={{ background: "#fff1f0" }}
        >
          <Space
            align="start"
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space direction="vertical" size={2}>
              <Space>
                {action.icon}
                <Text strong>{action.title}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {action.description}
              </Text>
              <Tag color="red" style={{ marginTop: 4 }}>
                影响：{action.impact}
              </Tag>
            </Space>
            {action.button}
          </Space>
        </Card>
      ))}

      {/* 当前账户信息 */}
      <Card size="small" title="当前账户信息">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Principal ID">
            <Text code>{principal?.id ?? "—"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tenant">
            <Text code>{auth?.tenant?.code ?? "—"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            <Text>{principal?.email ?? "—"}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Button
        onClick={handleLogoutAll}
        loading={logoutMutation.isPending}
        icon={<LogoutOutlined />}
      >
        退出当前会话登录
      </Button>

      <Text type="secondary" style={{ fontSize: 12 }}>
        * V0 阶段危险动作仅前端 Mock；V1 接入 IAM/Audit API
        后将触发实际数据销毁、Step-up 认证和审计日志写入。
      </Text>

      {/* 注销账户 Step-up 对话框 */}
      <Modal
        title={
          <span style={{ color: "#cf1322" }}>
            <WarningOutlined style={{ marginRight: 8 }} />
            Step-up 认证：注销账户
          </span>
        }
        open={pendingAction === "delete-account"}
        onCancel={() => {
          setPendingAction(null);
          setConfirmText("");
        }}
        onOk={confirmDeleteAccount}
        okText="提交注销申请"
        okType="danger"
        cancelText="取消"
        width={520}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message="此操作不可逆"
            description="账户一旦注销，将无法恢复任何数据、归属关系和历史记录。"
          />
          <Descriptions column={1} size="small" title="影响预览">
            <Descriptions.Item label="拥有项目">
              <Tag color="orange">{impactPreview.ownedProjects} 个</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="拥有文档">
              <Tag color="orange">{impactPreview.ownedDocuments} 个</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="待审任务">
              <Tag color="orange">{impactPreview.pendingReviews} 个</Tag>
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="info"
            showIcon
            message="替代方案"
            description="如仅需暂停账户（如长期休假），请联系管理员禁用账户而非注销，可保留数据。"
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              请输入 <Text code>DELETE MY ACCOUNT</Text> 以确认：
            </Text>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
