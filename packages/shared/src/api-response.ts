/**
 * D35 统一响应格式
 * 双层状态码：HTTP 状态码 + 业务 code
 * 权威源：@design/D35-API-事件契约.md §D35.9
 */

/**
 * 业务码常量（0 表示成功，非 0 表示业务错误）
 */
export const BIZ_CODE = {
  SUCCESS: 0,
} as const;

/**
 * 统一成功响应
 * @template T - data 负载类型
 */
export interface ApiResponse<T = unknown> {
  /** 业务码，0 表示成功 */
  code: typeof BIZ_CODE.SUCCESS;
  /** 响应数据 */
  data: T;
  /** 可选提示信息 */
  message?: string;
  /** 全链路追踪 ID（UUIDv7） */
  traceId: string;
}

/**
 * 统一错误响应（简化版，与 Problem Details 对应）
 * 权威源 D35.9 使用 RFC 9457 application/problem+json
 * 此为 TypeScript 侧精简表示，Java 侧用 ProblemDetail
 */
export interface ApiErrorResponse {
  /** 业务错误码（非 0） */
  code: number;
  /** 稳定错误码字符串（机器可读，不本地化） */
  errorCode: string;
  /** HTTP 状态码 */
  status: number;
  /** 可本地化的错误标题 */
  title: string;
  /** 可本地化的详细描述（不得被客户端用于分支判断） */
  detail: string;
  /** 关联 ID（同 traceId 语义） */
  correlationId: string;
  /** 字段级错误明细 */
  errors?: FieldError[];
  /** 是否可重试 */
  retryable: boolean;
  /** 重试建议秒数 */
  retryAfter?: number;
}

/**
 * 字段级错误
 */
export interface FieldError {
  /** 字段错误码 */
  code: string;
  /** JSON Pointer 指向出错字段 */
  pointer: string;
  /** 参数名 */
  parameter: string;
  /** 资源 ID（如有） */
  resourceId?: string;
}

/**
 * 判断响应是否成功
 */
export function isSuccess<T>(
  response: ApiResponse<T>,
): response is ApiResponse<T> {
  return response.code === BIZ_CODE.SUCCESS;
}

/**
 * 分页请求参数（偏移分页，适用于小字典）
 */
export interface OffsetPageRequest {
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * 分页响应（偏移分页）
 */
export interface OffsetPageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 游标分页请求（keyset cursor，适用于资产/Issue/Run 等大规模列表）
 * 权威源：D35.6
 */
export interface CursorPageRequest {
  /** 不透明游标（首屏为 null） */
  cursor?: string | null;
  /** 每页条数 */
  pageSize: number;
  /** 排序表达式，如 sort=-updatedAt,id */
  sort?: string;
}

/**
 * 游标分页响应
 */
export interface CursorPageResponse<T> {
  items: T[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}
