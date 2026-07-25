"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  GenerateSolutionRequest,
  GenerateSolutionResponse,
  PromptTemplateDto,
} from "@design-platform/shared";
import {
  HttpHeader,
  SolutionsApiPaths,
  generateSolutionResponseSchema,
} from "@design-platform/shared";
import { validateResponseStrict } from "@/lib/schema-validator";

/** API 基础路径：优先使用 NEXT_PUBLIC_BFF_URL，未配置则走同源 /api */
const API_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "";

/** 浏览器端 cookie 读取 access token */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)",
    ),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** 生成请求 ID（traceId） */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 调用方案生成端点
 *
 * AI Service 响应不遵循 ApiResponse 包装格式（直接返回业务对象），
 * 因此不使用 apiPost，而是专用 fetch 仅校验 HTTP 状态码。
 *
 * 契约验证（security.md §12 AI 安全红线）：严格模式
 *  - 强制 isAiAssisted=true 与 requiresHumanReview 字段
 *  - 防止未标记 AI 内容进入业务流程
 *  - 验证失败抛 ResponseValidationError，触发人工复核流程
 */
async function callGenerateSolution(
  request: GenerateSolutionRequest,
): Promise<GenerateSolutionResponse> {
  const headers = new Headers({
    "Content-Type": "application/json",
    [HttpHeader.X_TRACE_ID]: generateRequestId(),
  });

  const accessToken = readCookie("access_token");
  if (accessToken) {
    headers.set(HttpHeader.AUTHORIZATION, `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${SolutionsApiPaths.generate}`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // AI Service 错误格式为 { detail: string }（FastAPI HTTPException）
    const errorDetail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText || `请求失败：${response.status}`;
    throw new Error(errorDetail);
  }

  // 严格验证：AI 响应必须符合 generateSolutionResponseSchema
  // 强制 isAiAssisted=true 与 requiresHumanReview 字段存在
  return validateResponseStrict(payload, generateSolutionResponseSchema, {
    context: "useGenerateSolution",
  }) as GenerateSolutionResponse;
}

/**
 * 生成方案候选
 * 调用 POST /api/v1/solutions/generate
 *
 * 所有响应强制 isAiAssisted=true，按风险等级进入人工复核
 */
export function useGenerateSolution() {
  return useMutation<GenerateSolutionResponse, Error, GenerateSolutionRequest>({
    mutationFn: callGenerateSolution,
  });
}

/**
 * Prompt 模板元数据（前端静态映射，用于页面下拉选择）
 * 实际模板内容从 /api/v1/prompts 端点获取
 */
export const PROMPT_TEMPLATE_OPTIONS: ReadonlyArray<{
  name: string;
  label: string;
  description: string;
}> = [
  {
    name: "concept-generation",
    label: "概念方案生成",
    description: "基于主创草图与设计任务书生成概念方案候选",
  },
  {
    name: "scheme-deepening",
    label: "方案深化建议",
    description: "基于 G1 Concept Baseline 生成方案深化建议",
  },
  {
    name: "design-option-comparison",
    label: "方案比选分析",
    description: "多方案对比与权衡分析，呈现 Pareto 前沿",
  },
  {
    name: "design-summary",
    label: "方案摘要",
    description: "设计方案文本摘要生成，用于汇报材料",
  },
];

/**
 * 各模板所需的变量定义（用于动态渲染表单）
 */
export const TEMPLATE_VARIABLES: Record<
  string,
  ReadonlyArray<{
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
  }>
> = {
  "concept-generation": [
    {
      key: "siteDescription",
      label: "场地描述",
      placeholder: "如：上海某地块，占地 5000㎡",
      required: true,
    },
    {
      key: "brief",
      label: "设计任务书",
      placeholder: "如：办公塔楼，5-15 层",
      required: true,
    },
    {
      key: "referenceImages",
      label: "参考图 URL",
      placeholder: "无则填'无'",
      required: true,
    },
    {
      key: "constraints",
      label: "硬约束",
      placeholder: "如：限高 60m，容积率 3.0",
      required: true,
    },
  ],
  "scheme-deepening": [
    {
      key: "conceptBaseline",
      label: "G1 Concept Baseline 摘要",
      placeholder: "如：塔楼 + 裙房，地上 12 层",
      required: true,
    },
    {
      key: "deepeningScope",
      label: "深化范围",
      placeholder: "如：space,envelope,structure,mep",
      required: true,
    },
    {
      key: "focusAspects",
      label: "重点关注维度",
      placeholder: "如：疏散，采光，能耗",
      required: true,
    },
  ],
  "design-option-comparison": [
    {
      key: "options",
      label: "方案列表",
      placeholder: 'JSON 数组，如 [{"name":"A","description":"..."}]',
      required: true,
    },
    {
      key: "criteria",
      label: "评估准则",
      placeholder: "如：成本，工期，可持续性",
      required: true,
    },
    {
      key: "constraints",
      label: "硬约束",
      placeholder: "如：限高，容积率",
      required: true,
    },
  ],
  "design-summary": [
    {
      key: "content",
      label: "方案描述",
      placeholder: "待摘要的方案文本",
      required: true,
    },
  ],
};

/** 获取模板的变量定义 */
export function getTemplateVariables(templateName: string): ReadonlyArray<{
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}> {
  return TEMPLATE_VARIABLES[templateName] ?? [];
}

/** 获取模板的显示标签 */
export function getTemplateLabel(templateName: string): string {
  return (
    PROMPT_TEMPLATE_OPTIONS.find((t) => t.name === templateName)?.label ??
    templateName
  );
}

/**
 * 查询可用 Prompt 模板列表
 * 调用 GET /api/v1/prompts
 *
 * 用于页面下拉选择，复用 apiGet（遵循 ApiResponse 包装格式，由 BFF 透传 AI Service 响应）
 * 注意：prompts 端点响应格式为 PromptTemplateDto[]，不走 ApiResponse 包装
 */
export async function fetchPromptTemplates(): Promise<PromptTemplateDto[]> {
  const headers = new Headers({
    [HttpHeader.X_TRACE_ID]: generateRequestId(),
  });
  const accessToken = readCookie("access_token");
  if (accessToken) {
    headers.set(HttpHeader.AUTHORIZATION, `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/prompts`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`获取 Prompt 模板失败：${response.status}`);
  }

  return (await response.json()) as PromptTemplateDto[];
}
