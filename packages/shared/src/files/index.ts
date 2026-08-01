/**
 * 文件契约模块统一导出（P0-2.3 File/Manifest 契约）
 *
 * 覆盖：
 *  - 文件校验工具——浏览器安全部分（扩展名白名单/MIME/魔数/zip bomb）
 *  - FileManifest 证据契约（对象元数据 + 保留策略 + 签名）
 *
 * 注意：依赖 Node 内置模块的校验函数（sha256 / isPathSafe / validateFile）
 * 从 "./file-validator.node" 导入，仅供 BFF/服务端使用。
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
} from "./file-validator";
export type {
  AllowedDesignExtension,
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
