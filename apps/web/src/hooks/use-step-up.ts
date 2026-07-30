"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  StepUpTokenRequest,
  StepUpTokenResponse,
} from "@design-platform/shared";
import { AuthApiPaths } from "@design-platform/shared";
import { apiPost } from "@/lib/api-client";

/**
 * Step-up 二次认证 hook
 *
 * 业务用途：在执行危险动作（HIGH/IRREVERSIBLE 风险等级的 OperationsAction）前调用本 hook，
 * 用户输入当前密码后服务端签发短期 step-up token（5 分钟），后续 OperationsAction 请求
 * 携带此 token 才能执行危险动作。
 *
 * 安全约束（见 security.md §12 / D40 §Step-up 认证）：
 * - step-up token 仅保存在调用方内存中（mutation 返回值），不写入 localStorage / cookie
 * - 5 分钟过期后需重新申请
 * - token 不可用于普通 API 认证，仅可放入 OperationsActionRequest.stepUpToken 字段
 *
 * 典型调用方式：
 * ```tsx
 * const stepUpMutation = useStepUpToken();
 * const handleDangerousAction = async () => {
 *   const { stepUpToken } = await stepUpMutation.mutateAsync({
 *     currentPassword: "user-password",
 *     purpose: "执行 ISOLATE 动作",
 *   });
 *   // 后续传入 operationsAction.mutateAsync({ stepUpToken, ... })
 * };
 * ```
 *
 * @design D40-信息-物理安全.md §Step-up 认证
 * @design D37-关键界面-交互状态.md §D37.17 危险动作
 */
export function useStepUpToken() {
  return useMutation<StepUpTokenResponse, Error, StepUpTokenRequest>({
    // step-up 响应结构简单，不做严格 schema 验证
    // 失败时统一抛 BusinessException（密码错误 / 主体禁用等）
    mutationFn: (payload) =>
      apiPost<StepUpTokenResponse>(AuthApiPaths.stepUp, payload),
    retry: false, // 密码错误不重试，避免触发防枚举限流
  });
}
