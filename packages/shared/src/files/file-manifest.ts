/**
 * FileManifest 契约（P0-2.3 File/Manifest 契约）
 *
 * 文件证据 Manifest：描述上传/发布文件的对象元数据与证据属性。
 * 字段对齐路线图 P0-1.4 TestEvidence Manifest：
 *  type/objectUri/hash/tool/version/raw-summary/retention/classification/signature
 *
 * 用途：
 *  - CDE 上传/发布时生成 Manifest，作为验收证据（D45）
 *  - Evidence Package 封存（D41 WORM/签名/TSA）
 *  - 事件 data 中引用对象（大/敏感内容走 Manifest 引用，不内联）
 *
 * 权威源：.trae/rules/security.md §8 PII 分级 + @design/D45-测试-验收体系.md §D45.10
 *         + @design/D35-API-事件契约.md §D35.10
 */
import { z } from "zod";
import { EVENT_CLASSIFICATION_SCHEMA } from "../events/cloud-event";

/** Manifest 文件类型（对齐文件上传域） */
export const manifestFileTypeSchema = z.enum([
  "design_source", // 设计源文件（.rvt/.dwg/.skp/.3dm/.rfa/.dxf）
  "rendering", // 渲染图
  "pdf", // 图纸/报告
  "manifest", // Manifest 自身
  "evidence", // 测试证据
]);

/** 保留策略（对齐 security.md §9 数据生命周期留存期） */
export const manifestRetentionSchema = z.enum([
  "project_lifetime", // 项目生命周期
  "legal_hold", // 法律保留（L5 核心文件）
  "30_days",
  "90_days",
  "1_year",
]);

/** 文件签名算法（证据可校验） */
export const manifestSignatureAlgorithmSchema = z.enum([
  "HMAC-SHA256",
  "RSA-SHA256",
  "RFC3161-TSA", // 时间戳签名
]);

/** 文件证据 Manifest（对齐 P0-1.4 TestEvidence Manifest 字段） */
export const fileManifestSchema = z.object({
  /** Manifest ID（UUID） */
  manifestId: z.string().min(1),
  /** 文件类型 */
  fileType: manifestFileTypeSchema,
  /** 对象存储 URI（S3/MinIO） */
  objectUri: z.string().url(),
  /** 内容哈希（SHA-256 hex） */
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  /** 生成工具（如 "bff-upload/v0.1.0"） */
  tool: z.string().min(1).max(100),
  /** 工具版本 */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** 原始摘要（脱敏，不含敏感内容） */
  rawSummary: z.string().max(512),
  /** 保留策略 */
  retention: manifestRetentionSchema,
  /** 数据分类（对齐 security.md §8 PII 分级） */
  classification: EVENT_CLASSIFICATION_SCHEMA,
  /** 文件大小（字节） */
  sizeBytes: z.number().int().nonnegative(),
  /** 原始文件名（不含路径，防路径注入） */
  fileName: z.string().regex(/^[^/\\]+$/),
  /** 签名（证据可校验，可选） */
  signature: z
    .object({
      algorithm: manifestSignatureAlgorithmSchema,
      /** 签名值（Base64） */
      value: z.string().min(1),
      /** 签名密钥 ID（HMAC/RSA）或 TSA 证书引用 */
      keyId: z.string().optional(),
    })
    .optional(),
  /** 创建时间（UTC ISO8601） */
  createdAt: z.string().datetime({ offset: true }),
});

/** FileManifest 类型 */
export type FileManifest = z.infer<typeof fileManifestSchema>;

/** 构建 Manifest 输入（自动生成 createdAt） */
export interface BuildManifestInput {
  manifestId: string;
  fileType: z.infer<typeof manifestFileTypeSchema>;
  objectUri: string;
  hash: string;
  tool: string;
  version: string;
  rawSummary: string;
  retention: z.infer<typeof manifestRetentionSchema>;
  classification: z.infer<typeof EVENT_CLASSIFICATION_SCHEMA>;
  sizeBytes: number;
  fileName: string;
  signature?: FileManifest["signature"];
}

/**
 * 构建文件证据 Manifest（自动填充 createdAt）
 *
 * @param input Manifest 字段（不含 createdAt）
 * @returns 完整 FileManifest
 */
export function buildFileManifest(input: BuildManifestInput): FileManifest {
  return {
    ...input,
    createdAt: new Date().toISOString(),
  };
}
