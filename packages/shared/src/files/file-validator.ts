/**
 * 文件校验工具——浏览器安全部分（P0-2.3 File/Manifest 契约）
 *
 * 仅包含不依赖 Node 内置模块的纯函数与常量：
 *  - 扩展名白名单（security.md §4：.rvt/.3dm/.skp/.dwg/.rfa/.dxf）
 *  - MIME 类型白名单映射
 *  - 魔数（magic bytes）校验（RVT/RFA=OLE CFB、DWG=AC10 版本头、DXF=文本 Section）
 *  - zip bomb 启发式检测（压缩比异常高）
 *
 * 依赖 Node 内置模块（node:crypto / node:path / Buffer）的函数
 * （sha256 / isPathSafe / validateFile）请从 "./file-validator.node" 导入，
 * 避免被浏览器端打包（web 构建报 UnhandledSchemeError）。
 *
 * 权威源：.trae/rules/security.md §4 输入校验 + §6.3 路径穿越防护
 *         + @design/D35-API-事件契约.md §D35.10 文件上传、下载与内容协商
 */

/** 允许的设计文件扩展名白名单（security.md §4） */
export const ALLOWED_DESIGN_EXTENSIONS = [
  ".rvt",
  ".3dm",
  ".skp",
  ".dwg",
  ".rfa",
  ".dxf",
  ".ifc",
] as const;
export type AllowedDesignExtension = (typeof ALLOWED_DESIGN_EXTENSIONS)[number];

/** 扩展名 → 声明的 MIME 类型映射 */
export const DESIGN_EXTENSION_MIME: Readonly<Record<string, string>> = {
  ".rvt": "application/vnd.autodesk.revit",
  ".rfa": "application/vnd.autodesk.revit.family",
  ".dwg": "application/acad",
  ".dxf": "application/dxf",
  ".3dm": "application/x-rhino-3dm",
  ".skp": "application/vnd.sketchup.skp",
  ".ifc": "application/ifc",
};

/** 默认最大文件大小（设计文件通常较大，100MB） */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** 魔数检测结果类型 */
export type MagicDetectResult =
  "ole-cfb" | "dwg" | "dxf" | "ifc" | "unsupported" | "unknown";

/** 魔数表（真实格式文件头） */
const MAGIC_SIGNATURES: ReadonlyArray<{
  type: MagicDetectResult;
  /** 匹配前缀字节（二进制格式） */
  bytes?: readonly number[];
  /** 匹配 ASCII 前缀（文本格式） */
  ascii?: string;
}> = [
  // OLE Compound File（Revit RVT/RFA 家族）
  { type: "ole-cfb", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  // DWG：ASCII "AC10" + 两位版本号（AC1015=2000 ... AC1032=2018）
  { type: "dwg", ascii: "AC10" },
  // DXF：AutoCAD 文本格式，以 "  0" 行开始（行分隔符 \n 或 \r\n）
  { type: "dxf", ascii: "0\nSECTION" },
  // IFC：ISO-10303-21 文本头
  { type: "ifc", ascii: "ISO-10303-21" },
];

/**
 * 校验扩展名是否在白名单内
 *
 * @param fileName 原始文件名
 * @returns true = 允许；false = 拒绝（security.md §4 白名单）
 */
export function isAllowedExtension(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return (ALLOWED_DESIGN_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * 校验 MIME 类型是否匹配白名单
 *
 * @param mimeType 声明的 MIME 类型
 * @returns true = 允许；false = 拒绝
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return Object.values(DESIGN_EXTENSION_MIME).includes(mimeType);
}

/**
 * 检测文件内容魔数（magic bytes）
 *
 * @param buffer 文件内容（Uint8Array，浏览器与 Node 通用）
 * @returns 检测结果：ole-cfb/dwg/dxf/ifc（strict 匹配）/ unsupported（已知设计格式无魔数）/ unknown（未识别）
 */
export function detectMagic(buffer: Uint8Array): {
  magic: MagicDetectResult;
  level: "strict" | "unsupported" | "unknown";
} {
  if (buffer.length === 0) {
    return { magic: "unknown", level: "unknown" };
  }

  // 二进制魔数匹配（前缀字节序列）
  for (const signature of MAGIC_SIGNATURES) {
    if (signature.bytes && signature.bytes.length > 0) {
      const matched = signature.bytes.every(
        (byte, index) => buffer[index] === byte,
      );
      if (matched) {
        return { magic: signature.type, level: "strict" };
      }
    }
  }

  // ASCII 前缀匹配（文本格式，前 64 字节内查找，容错 BOM/空白）
  const head = new TextDecoder()
    .decode(buffer.subarray(0, 64))
    .replace(/^\uFEFF/, "")
    .trimStart();
  for (const signature of MAGIC_SIGNATURES) {
    if (signature.ascii && head.startsWith(signature.ascii)) {
      return { magic: signature.type, level: "strict" };
    }
  }

  return { magic: "unknown", level: "unknown" };
}

/**
 * zip bomb 启发式检测（压缩比异常高）
 *
 * V0 简化：不解析 zip 结构，由调用方提供压缩前后大小比对。
 * V1 演进：解析 ZIP central directory 计算真实解压体积（D35.10 Sandbox）。
 *
 * @param compressedBytes 压缩后大小
 * @param uncompressedBytes 解压后大小
 * @param maxRatio 允许的最大压缩比（默认 1000:1）
 * @returns true = 疑似 zip bomb
 */
export function isLikelyZipBomb(
  compressedBytes: number,
  uncompressedBytes: number,
  maxRatio = 1000,
): boolean {
  if (compressedBytes <= 0) {
    return false;
  }
  return uncompressedBytes / compressedBytes > maxRatio;
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
