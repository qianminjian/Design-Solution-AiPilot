/**
 * 文件校验工具——Node 专用部分（P0-2.3 File/Manifest 契约）
 *
 * 依赖 Node 内置模块（node:crypto / node:path / Buffer），
 * 仅供 BFF/服务端使用，禁止在浏览器端导入（web 构建报 UnhandledSchemeError）。
 *
 * 提供：
 *  - SHA-256 内容哈希（证据可校验）
 *  - 路径穿越防护（path.resolve 校验安全根目录，security.md §6.3）
 *  - 完整文件校验（扩展名 + MIME + 大小 + 魔数 + polyglot + 哈希）
 *
 * 权威源：.trae/rules/security.md §4 输入校验 + §6.3 路径穿越防护
 *         + @design/D35-API-事件契约.md §D35.10 文件上传、下载与内容协商
 */
import { createHash } from "node:crypto";
import { resolve as resolvePath } from "node:path";
import {
  DEFAULT_MAX_FILE_SIZE_BYTES,
  detectMagic,
  isAllowedExtension,
  isAllowedMimeType,
  type MagicDetectResult,
} from "./file-validator";

/** 文件校验错误码 */
export type FileValidationErrorCode =
  | "EMPTY_FILE"
  | "INVALID_EXTENSION"
  | "INVALID_MIME"
  | "SIZE_EXCEEDED"
  | "MAGIC_MISMATCH"
  | "UNSAFE_PATH"
  | "POLYGLOT_RISK";

/** 文件校验结果 */
export interface FileValidationResult {
  /** 是否通过全部校验 */
  readonly valid: boolean;
  /** 错误码列表（valid=false 时非空） */
  readonly errors: readonly FileValidationErrorCode[];
  /** 检测到的魔数类型 */
  readonly magic: MagicDetectResult;
  /** 魔数校验级别（strict=已匹配/unsupported=无公开魔数/unknown=未识别） */
  readonly magicLevel: "strict" | "unsupported" | "unknown";
  /** 计算的内容哈希（SHA-256 hex） */
  readonly sha256: string;
  /** 校验耗时（ms，供 SLO 监控） */
  readonly durationMs: number;
}

/** 文件校验输入 */
export interface FileToValidate {
  /** 原始文件名（含扩展名） */
  readonly fileName: string;
  /** 声明的 MIME 类型（客户端或代理提供） */
  readonly mimeType?: string;
  /** 文件大小（字节） */
  readonly size: number;
  /** 文件内容（魔数与哈希校验用） */
  readonly buffer: Buffer;
}

/**
 * 路径穿越防护（security.md §6.3）
 *
 * 使用 path.resolve 解析后校验是否仍在允许的根目录内。
 *
 * @param allowedRoot 允许的文件根目录
 * @param userInput 用户提供的相对路径
 * @returns true = 安全；false = 路径穿越风险
 */
export function isPathSafe(allowedRoot: string, userInput: string): boolean {
  const resolved = resolvePath(allowedRoot, userInput);
  const rootWithSep = allowedRoot.endsWith("/")
    ? allowedRoot
    : `${allowedRoot}/`;
  return resolved === allowedRoot || resolved.startsWith(rootWithSep);
}

/**
 * 计算文件 SHA-256 内容哈希（证据可校验）
 *
 * @param buffer 文件内容
 * @returns 64 位小写 hex
 */
export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * 完整文件校验（扩展名 + MIME + 大小 + 魔数 + polyglot + 哈希）
 *
 * @param file 待校验文件
 * @param maxBytes 最大允许大小（默认 DEFAULT_MAX_FILE_SIZE_BYTES）
 * @returns 校验结果（valid=false 时 errors 列出全部违规项）
 */
export function validateFile(
  file: FileToValidate,
  maxBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
): FileValidationResult {
  const start = Date.now();
  const errors: FileValidationErrorCode[] = [];
  const ext = extensionOf(file.fileName);

  // 1. 空文件
  if (file.size === 0 || file.buffer.length === 0) {
    errors.push("EMPTY_FILE");
  }

  // 2. 扩展名白名单
  if (!isAllowedExtension(file.fileName)) {
    errors.push("INVALID_EXTENSION");
  }

  // 3. MIME 类型白名单
  if (file.mimeType && !isAllowedMimeType(file.mimeType)) {
    errors.push("INVALID_MIME");
  }

  // 4. 文件大小限制（资源耗尽防护）
  if (file.size > maxBytes) {
    errors.push("SIZE_EXCEEDED");
  }

  // 5. 魔数校验 + polyglot 检测
  const { magic, level } = detectMagic(file.buffer);
  if (level === "strict") {
    // 魔数对应的预期扩展名
    const expectedExtension = expectedExtensionForMagic(magic);
    if (expectedExtension && ext !== expectedExtension) {
      // 声明的扩展名与魔数不一致 → polyglot 风险（MIME 混淆）
      errors.push("POLYGLOT_RISK");
    }
  }

  // 6. 内容哈希
  const hash = sha256(file.buffer);

  return {
    valid: errors.length === 0,
    errors,
    magic,
    magicLevel: level,
    sha256: hash,
    durationMs: Date.now() - start,
  };
}

/**
 * 提取文件扩展名（小写，含点）
 */
function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index < 0) {
    return "";
  }
  return fileName.slice(index).toLowerCase();
}

/**
 * 魔数类型 → 预期扩展名（polyglot 检测用）
 */
function expectedExtensionForMagic(magic: MagicDetectResult): string | null {
  switch (magic) {
    case "ole-cfb":
      return ".rvt"; // RVT/RFA 家族，RVT 为默认预期
    case "dwg":
      return ".dwg";
    case "dxf":
      return ".dxf";
    case "ifc":
      return ".ifc";
    default:
      return null;
  }
}
