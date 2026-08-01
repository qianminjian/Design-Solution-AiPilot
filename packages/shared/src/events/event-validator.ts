/**
 * 事件校验工具（P0-2.2 Event/AsyncAPI 契约）
 *
 * 覆盖 D35.22/24 事件语义：
 *  - 去重：按事件 id 幂等（重投不变）
 *  - 顺序：按 aggregateVersion 分类（正常/重放/迟到/乱序）
 *  - 缺口：detectGaps 检测缺失版本（事件丢失检测，触发回源/补发）
 *  - 分区 key：tenantId/aggregateId 组合保持单聚合有序
 *  - 有界重试：投递失败重试有上限，超过进入 DLQ
 *  - upcast：dataschema 版本迁移（Schema Evolution，兼容旧版本事件）
 *
 * 权威源：@design/D35-API-事件契约.md §D35.22 安全、异常与恢复 + §D35.24 D35 验收条件
 *         + @design/D35-API-事件契约.md §D35.18 版本、弃用与兼容策略
 */
import type { CloudEvent } from "./cloud-event";

/** 顺序分类结果 */
export type EventOrdering = "in-order" | "duplicate" | "late" | "out-of-order";

/** DLQ 原因枚举（对齐 D35.22 异常处理） */
export type DlqReason =
  | "retry_exhausted"
  | "unrecoverable_error"
  | "schema_incompatible"
  | "invalid_event";

/**
 * 构建分区 key（对齐 D35.13 Topic 规则：按 tenant/aggregateId 组合 key 保持单聚合有序）
 *
 * @param event CloudEvent 事件
 * @returns 分区 key，如 "tenant-001/aggregate-001"
 */
export function buildEventKey(event: CloudEvent): string {
  return `${event.extensions.tenantId}/${event.extensions.aggregateId}`;
}

/**
 * 去重判定：事件 id 是否已处理过（按 id 幂等，重投不变）
 *
 * @param event CloudEvent 事件
 * @param processedIds 已处理事件 id 集合
 * @returns true = 重复事件，应跳过处理
 */
export function isDuplicate(
  event: CloudEvent,
  processedIds: ReadonlySet<string>,
): boolean {
  return processedIds.has(event.id);
}

/**
 * 顺序分类（按 aggregateVersion 检测，对齐 D35.22 顺序语义）
 *
 *  - in-order：version = lastVersion + 1（正常推进）
 *  - duplicate：version = lastVersion（重放，已处理）
 *  - late：version < lastVersion（迟到，存在更高版本已处理）
 *  - out-of-order：version > lastVersion + 1（乱序，存在缺口）
 *
 * @param event CloudEvent 事件
 * @param lastProcessedVersion 该分区最后已处理的 aggregateVersion
 * @param alreadyProcessed 该事件是否已处理过（按 id）
 * @returns 顺序分类结果
 */
export function classifyOrdering(
  event: CloudEvent,
  lastProcessedVersion: number,
  alreadyProcessed = false,
): EventOrdering {
  const version = event.extensions.aggregateVersion;

  if (alreadyProcessed) {
    return "duplicate";
  }
  if (version === lastProcessedVersion) {
    return "duplicate";
  }
  if (version < lastProcessedVersion) {
    return "late";
  }
  if (version > lastProcessedVersion + 1) {
    return "out-of-order";
  }
  return "in-order";
}

/**
 * 缺口检测：找出 [1..maxVersion] 中缺失的版本号（事件丢失检测）
 *
 * 触发 D35.22 "Event 丢失/乱序 → gap detect → 回源/补发" 流程
 *
 * @param versions 已接收事件的 aggregateVersion 列表
 * @returns 缺失版本列表（升序）
 */
export function detectGaps(versions: readonly number[]): number[] {
  if (versions.length === 0) {
    return [];
  }
  const sorted = [...new Set(versions)].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] ?? 0;
  const present = new Set(sorted);
  const gaps: number[] = [];
  for (let v = 1; v < max; v += 1) {
    if (!present.has(v)) {
      gaps.push(v);
    }
  }
  return gaps;
}

/**
 * 有界重试判定（对齐 D35.11/22 有界重试）
 *
 * @param attempt 当前重试次数（0 = 首次投递失败）
 * @param maxAttempts 最大重试上限
 * @param isRetryable 错误是否可重试（如网络抖动可重试，schema 不兼容不可重试）
 * @returns true = 应继续重试
 */
export function shouldRetry(
  attempt: number,
  maxAttempts: number,
  isRetryable: boolean,
): boolean {
  return isRetryable && attempt < maxAttempts;
}

/**
 * DLQ 判定：超过重试上限或错误不可恢复时进入死信队列
 *
 * @param attempt 当前重试次数
 * @param maxAttempts 最大重试上限
 * @param isRetryable 错误是否可重试
 * @param isSchemaCompatible 事件 schema 是否与当前消费者兼容（upcast 后）
 * @returns 未达 DLQ 条件返回 null，否则返回 DLQ 原因
 */
export function toDlqReason(
  attempt: number,
  maxAttempts: number,
  isRetryable: boolean,
  isSchemaCompatible: boolean,
): DlqReason | null {
  if (!isSchemaCompatible) {
    return "schema_incompatible";
  }
  if (!isRetryable) {
    return "unrecoverable_error";
  }
  if (attempt >= maxAttempts) {
    return "retry_exhausted";
  }
  return null;
}

/**
 * upcast 事件升级（Schema Evolution）
 *
 * 消费者订阅新版 schema 时，将旧 dataschema 版本的事件升级为新版本字段。
 * 不支持的版本组合返回 null（由调用方决定进入 DLQ）。
 *
 * @param event 旧版本事件
 * @param fromVersion dataschema 版本（如 "1"）
 * @param toVersion 目标版本（如 "2"）
 * @param upcasters 版本迁移函数表：{ "1->2": (event) => CloudEvent }
 * @returns 升级后的事件；无可用迁移返回 null
 */
export function upcastEvent(
  event: CloudEvent,
  fromVersion: string,
  toVersion: string,
  upcasters: Readonly<Record<string, (event: CloudEvent) => CloudEvent>>,
): CloudEvent | null {
  const key = `${fromVersion}->${toVersion}`;
  const upcaster = upcasters[key];
  if (!upcaster) {
    return null;
  }
  const upcasted = upcaster(event);
  // 升级后必须仍是合法 CloudEvent（信封字段不变）
  if (upcasted.specversion !== event.specversion || upcasted.id !== event.id) {
    throw new Error(`upcast 不得修改信封字段（specversion/id）：${event.type}`);
  }
  return upcasted;
}

/**
 * 从 dataschema URI 提取版本号
 *
 * dataschema 格式：https://schema.aipilot.local/{domain}/{event-type}/{version}
 *
 * @param dataschema Schema Registry 版本 URI
 * @returns 版本号字符串（如 "1"）；解析失败返回 null
 */
export function parseSchemaVersion(dataschema: string): string | null {
  const match = dataschema.match(/\/(\d+)$/);
  return match?.[1] ?? null;
}
