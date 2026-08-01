"use client";

import { App, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  ConnectorRegisterRequest,
  ConnectorStatusDto,
  ConnectorType,
  OperationsActionRequest,
  OperationsActionResponseDto,
  QueueTaskDto,
} from "@design-platform/shared";
import { QUEUE_TYPE_LABEL } from "@design-platform/shared";
import type { UseMutationResult } from "@tanstack/react-query";
import type { FormInstance } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import type { DualApprovalAction } from "@/components/operations/dual-approval-modal";
import type { useStepUpToken } from "@/hooks/use-step-up";

/**
 * Monitoring 页面处理器 hook（D37.17 §Operations 危险动作）
 *
 * 封装以下操作的完整业务流程：
 *  - handleRetryStormRecovery：IRREVERSIBLE cancel 动作（stepUpToken + 失败任务选择 + 原因）
 *  - handlePauseResource：MEDIUM PAUSE 动作（影响预览 + 原因）
 *  - handleResumeResource：LOW RESUME 动作（直接执行，无需 stepUpToken）
 *  - handleDeleteResource：IRREVERSIBLE DELETE 动作（stepUpToken + 影响预览 + 双人审批入口）
 *
 * 安全红线（D37.23 §不可逆/合规）：
 *  - HIGH/IRREVERSIBLE 动作必须 stepUpToken 二次认证
 *  - IRREVERSIBLE 动作必须进入双人审批流程
 *  - 所有动作必须 impactPreviewAcknowledged=true（除 LOW）
 *  - 原因必填，进入审计日志
 */
export interface MonitoringHandlersOptions {
  message: MessageInstance;
  modal: ReturnType<typeof App.useApp>["modal"];
  queueTasks: QueueTaskDto[];
  operationsActionMutation: UseMutationResult<
    OperationsActionResponseDto,
    Error,
    OperationsActionRequest,
    unknown
  >;
  stepUpMutation: ReturnType<typeof useStepUpToken>;
  registerConnectorMutation: UseMutationResult<
    ConnectorStatusDto,
    Error,
    ConnectorRegisterRequest,
    unknown
  >;
  setActiveActionId: (id: string) => void;
  openApprovalModal: (kind: DualApprovalAction) => void;
  registerForm: FormInstance<{
    connectorCode: string;
    name: string;
    type: ConnectorType;
    region?: string;
    endpointUrl?: string;
    licenseRemaining?: string;
    isManualHandoff: boolean;
  }>;
  setRegisterModalOpen: (open: boolean) => void;
}

/**
 * 二次认证模态框（输入当前密码，获取 stepUpToken）
 */
async function requestStepUpToken(
  modal: MonitoringHandlersOptions["modal"],
  message: MessageInstance,
  stepUpMutation: MonitoringHandlersOptions["stepUpMutation"],
  purpose: string,
): Promise<string | null> {
  let currentPassword = "";
  let stepUpToken: string | null = null;
  await new Promise<void>((resolve) => {
    modal.confirm({
      title: "二次认证（Step-up）",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>{purpose}</div>
          <Input.Password
            placeholder="当前用户密码"
            onChange={(e) => {
              currentPassword = e.target.value;
            }}
            autoFocus
          />
          <div style={{ fontSize: 12, color: "#999" }}>
            Step-up token 5 分钟内有效，仅可用于本次操作。
          </div>
        </div>
      ),
      okText: "确认认证",
      cancelText: "取消",
      onOk: async () => {
        if (!currentPassword) {
          message.error("请输入当前用户密码");
          resolve();
          return;
        }
        try {
          const resp = await stepUpMutation.mutateAsync({
            currentPassword,
            purpose,
          });
          stepUpToken = resp.stepUpToken;
          resolve();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "认证失败";
          message.error(errMsg);
          resolve();
        }
      },
      onCancel: () => resolve(),
    });
  });
  return stepUpToken;
}

export function useMonitoringHandlers(options: MonitoringHandlersOptions) {
  const {
    message,
    modal,
    queueTasks,
    operationsActionMutation,
    stepUpMutation,
    registerConnectorMutation,
    setActiveActionId,
    registerForm,
    setRegisterModalOpen,
  } = options;

  const handleRetryStormRecovery = async () => {
    const failedTasks = queueTasks.filter((t) => t.status === "failed");
    if (failedTasks.length === 0) {
      message.info("未发现失败任务，可能 retry storm 状态已自动恢复");
      return;
    }

    // 第 1 步：申请 stepUpToken
    const stepUpToken = await requestStepUpToken(
      modal,
      message,
      stepUpMutation,
      "Retry Storm 恢复：取消失败任务",
    );
    if (!stepUpToken) return;

    // 第 2 步：选择失败任务 + 输入原因
    let selectedTaskId = failedTasks[0]?.id ?? "";
    let reason = "";
    await new Promise<void>((resolve) => {
      modal.confirm({
        title: "取消失败任务（解除 Retry Storm）",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 8,
                background: "#fff7e6",
                border: "1px solid #ffd591",
                borderRadius: 4,
              }}
            >
              <strong>不可逆操作</strong>
              ：取消失败任务将释放队列资源，任务不可恢复。建议先排查根因。
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                失败任务（共 {failedTasks.length} 个）
              </div>
              <select
                style={{ width: "100%", padding: 4 }}
                value={selectedTaskId}
                onChange={(e) => {
                  selectedTaskId = e.target.value;
                }}
              >
                {failedTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id.slice(0, 8)} · {QUEUE_TYPE_LABEL[t.type]} · 重试{" "}
                    {t.retryCount}/{t.maxRetries}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                取消原因（必填，进入审计日志）
              </div>
              <Input.TextArea
                rows={3}
                placeholder="例如：排查发现 OpenAI API 429 限流，已切换 Provider，取消该失败任务"
                onChange={(e) => {
                  reason = e.target.value;
                }}
              />
            </div>
          </div>
        ),
        okText: "确认取消任务",
        okType: "danger",
        okButtonProps: { loading: operationsActionMutation.isPending },
        cancelText: "取消",
        onOk: async () => {
          if (!selectedTaskId) {
            message.error("请选择失败任务");
            throw new Error("未选择任务");
          }
          if (!reason.trim()) {
            message.error("请填写取消原因");
            throw new Error("原因不能为空");
          }
          try {
            const resp = await operationsActionMutation.mutateAsync({
              actionType: "cancel",
              targetType: "queue_task",
              targetId: selectedTaskId,
              reason,
              stepUpToken: stepUpToken!,
              impactPreviewAcknowledged: true,
            });
            message.success(
              `任务 ${resp.targetId.slice(0, 8)} 已取消，操作 ID: ${resp.operationId.slice(0, 8)}`,
            );
            // 启用双人审批：cancel 为 IRREVERSIBLE 动作，保存 operationId 供审批人查看
            setActiveActionId(resp.operationId);
            resolve();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "取消失败";
            message.error(errMsg);
            throw err;
          }
        },
        onCancel: () => resolve(),
      });
    });
  };

  const handlePauseResource = async (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => {
    let reason = "";
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: `确认暂停 ${targetType === "worker" ? "Worker" : "连接器"}`,
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 8,
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: 4,
              }}
            >
              <strong>中等风险操作</strong>：暂停后 Worker
              将停止接收新任务，正在处理的任务会完成后再进入 STOPPED
              状态。该操作可逆，可通过 RESUME 恢复。
            </div>
            <div style={{ fontSize: 12 }}>
              <div>
                目标类型：{targetType === "worker" ? "Worker" : "Connector"}
              </div>
              <div>
                资源标识：<code>{targetId}</code>
              </div>
              <div>资源名称：{resourceName}</div>
              <div>风险等级：MEDIUM</div>
              <div>可逆性：可逆（RESUME 可恢复）</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                暂停原因（必填，进入审计日志）
              </div>
              <Input.TextArea
                rows={3}
                placeholder="例如：维护窗口，暂停任务处理"
                onChange={(e) => {
                  reason = e.target.value;
                }}
              />
            </div>
          </div>
        ),
        okText: "确认暂停",
        cancelText: "取消",
        onOk: async () => {
          if (!reason.trim()) {
            message.error("请填写暂停原因");
            return false;
          }
          resolve(true);
          return true;
        },
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    try {
      const resp = await operationsActionMutation.mutateAsync({
        actionType: "pause",
        targetType,
        targetId,
        reason,
        stepUpToken: "",
        impactPreviewAcknowledged: true,
      });
      message.success(
        `Worker 已暂停，操作 ID: ${resp.operationId.slice(0, 8)}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "暂停失败";
      message.error(errMsg);
    }
  };

  const handleResumeResource = async (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => {
    modal.confirm({
      title: `确认恢复 ${targetType === "worker" ? "Worker" : "连接器"}`,
      content: (
        <div>
          <div>
            恢复 {resourceName}（<code>{targetId.slice(0, 8)}</code>）至 IDLE
            状态，将重新接收任务调度。
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
            风险等级：LOW，无需二次认证。
          </div>
        </div>
      ),
      okText: "确认恢复",
      cancelText: "取消",
      onOk: async () => {
        try {
          const resp = await operationsActionMutation.mutateAsync({
            actionType: "resume",
            targetType,
            targetId,
            reason: "用户主动恢复 Worker",
            stepUpToken: "",
            impactPreviewAcknowledged: true,
          });
          message.success(
            `Worker 已恢复，操作 ID: ${resp.operationId.slice(0, 8)}`,
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "恢复失败";
          message.error(errMsg);
        }
      },
    });
  };

  const handleDeleteResource = async (
    targetType: "worker" | "connector",
    targetId: string,
    resourceName: string,
  ) => {
    // 第 1 步：申请 stepUpToken
    const stepUpToken = await requestStepUpToken(
      modal,
      message,
      stepUpMutation,
      `删除 ${targetType}: ${resourceName}`,
    );
    if (!stepUpToken) return;

    // 第 2 步：影响预览确认
    let reason = "";
    const confirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: `确认删除 ${targetType === "worker" ? "Worker" : "连接器"}（不可逆）`,
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 8,
                background: "#fff1f0",
                border: "1px solid #ffa39e",
                borderRadius: 4,
              }}
            >
              <strong>不可逆操作</strong>
              ：删除操作不可恢复，将永久移除资源记录及其关联审计日志引用。建议优先考虑
              isolate 或 pause 等可逆动作。
            </div>
            <div style={{ fontSize: 12 }}>
              <div>
                目标类型：{targetType === "worker" ? "Worker" : "Connector"}
              </div>
              <div>
                资源标识：<code>{targetId}</code>
              </div>
              <div>风险等级：IRREVERSIBLE</div>
              <div>审批要求：双人审批（审批人1 + 审批人2，间隔 ≥ 5 秒）</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                删除原因（必填，进入审计日志）
              </div>
              <Input.TextArea
                rows={3}
                placeholder="例如：资源已废弃，确认无关联任务后清理"
                onChange={(e) => {
                  reason = e.target.value;
                }}
              />
            </div>
          </div>
        ),
        okText: "确认提交双人审批",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          if (!reason.trim()) {
            message.error("请填写删除原因");
            return false;
          }
          resolve(true);
          return true;
        },
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    // 第 3 步：调用 DELETE 动作 API
    try {
      const resp = await operationsActionMutation.mutateAsync({
        actionType: "delete",
        targetType,
        targetId,
        reason,
        stepUpToken: stepUpToken,
        impactPreviewAcknowledged: true,
      });
      message.success(
        `删除申请已提交，等待双人审批。操作 ID: ${resp.operationId.slice(0, 8)}`,
      );
      // 自动打开双人审批模态框，进入审批人1流程
      setActiveActionId(resp.operationId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "提交删除申请失败";
      message.error(errMsg);
    }
  };

  const handleRegisterConnector = async () => {
    let values: {
      connectorCode: string;
      name: string;
      type: ConnectorType;
      region?: string;
      endpointUrl?: string;
      licenseRemaining?: string;
      isManualHandoff: boolean;
    };
    try {
      values = await registerForm.validateFields();
    } catch {
      return; // 校验失败不提交
    }
    try {
      const resp = await registerConnectorMutation.mutateAsync({
        connectorCode: values.connectorCode.trim(),
        name: values.name.trim(),
        type: values.type,
        region: values.region?.trim() || undefined,
        endpointUrl: values.endpointUrl?.trim() || null,
        licenseRemaining: values.licenseRemaining?.trim() || null,
        isManualHandoff: values.isManualHandoff,
      });
      const isAiProvider = values.type === "ai_provider";
      message.success(
        isAiProvider && resp.isManualHandoff
          ? `注册成功（AI_PROVIDER 已强制 ManualHandoff=true）: ${resp.name}`
          : `注册成功: ${resp.name}`,
      );
      setRegisterModalOpen(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "注册连接器失败";
      message.error(errMsg);
    }
  };

  return {
    handleRetryStormRecovery,
    handlePauseResource,
    handleResumeResource,
    handleDeleteResource,
    handleRegisterConnector,
  };
}

/**
 * 类型 stub：仅用于类型推断，实际未使用
 */
export type MonitoringColumnsType = ColumnsType<unknown>;
