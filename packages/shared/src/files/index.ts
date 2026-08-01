/**
 * 文件契约模块统一导出（P0-2.3 File/Manifest 契约）
 *
 * 覆盖：
 *  - 文件校验工具（扩展名白名单/MIME/魔数/大小/路径穿越/哈希/polyglot）
 *  - FileManifest 证据契约（对象元数据 + 保留策略 + 签名）
 *
 * 权威源：.trae/rules/security.md §4 输入校验 + §6.3 路径穿越防护
 *         + @design/D35-API-事件契约.md §D35.10 + @design/D45-测试-验收体系.md §D45.10
 */
export {
  ALLOWED_DESIGN_EXTENSIONS,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DESIGN_EXTENSION_MIME,
  detectMagic,
  isAllowedExtension,
  isAllowedMimeType,
  isLikelyZipBomb,
  isPathSafe,
  sha256,
  validateFile,
} from "./file-validator";
export type {
  AllowedDesignExtension,
  FileToValidate,
  FileValidationErrorCode,
  FileValidationResult,
  MagicDetectResult,
} from "./file-validator";

export {
  buildFileManifest,
  fileManifestSchema,
  manifestFileTypeSchema,
  manifestRetentionSchema,
  manifestSignatureAlgorithmSchema,
} from "./file-manifest";
export type { BuildManifestInput, FileManifest } from "./file-manifest";
