/**
 * 文件校验工具单元测试（P0-2.3 File/Manifest 契约）
 *
 * 覆盖 D35.10 + security.md §4/§6.3 场景：
 * - 扩展名白名单（.rvt/.dwg/.dxf/.rfa/.skp/.3dm/.ifc）
 * - MIME 类型白名单
 * - 魔数检测（OLE CFB / DWG / DXF / IFC / unsupported / unknown）
 * - 完整文件校验（大小限制/空文件/polyglot 风险）
 * - 路径穿越防护（.. 上跳 / 绝对路径 / 正常子路径）
 * - zip bomb 启发式检测
 * - SHA-256 内容哈希
 * - FileManifest 证据契约（schema 校验 + buildFileManifest）
 *
 * 权威源：.trae/rules/security.md §4 + §6.3 + @design/D35-API-事件契约.md §D35.10
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_DESIGN_EXTENSIONS,
  buildFileManifest,
  detectMagic,
  fileManifestSchema,
  isAllowedExtension,
  isAllowedMimeType,
  isLikelyZipBomb,
  isPathSafe,
  sha256,
  validateFile,
} from "../../../src/files";

/** OLE CFB 魔数（Revit RVT/RFA 文件头） */
const OLE_CFB_MAGIC = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00,
]);

/** DWG 文件头（AC1032 = AutoCAD 2018） */
const DWG_HEADER = Buffer.from("AC1032" + "\u0000".repeat(10), "ascii");

/** DXF 文本文件头 */
const DXF_HEADER = Buffer.from("  0\nSECTION\n  2\nHEADER\n", "ascii");

/** IFC 文本文件头 */
const IFC_HEADER = Buffer.from(
  "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(...);\n",
  "ascii",
);

describe("扩展名白名单（security.md §4）", () => {
  it("白名单应包含 7 种设计文件格式", () => {
    expect(ALLOWED_DESIGN_EXTENSIONS).toEqual([
      ".rvt",
      ".3dm",
      ".skp",
      ".dwg",
      ".rfa",
      ".dxf",
      ".ifc",
    ]);
  });

  it("应允许白名单内扩展名（大小写不敏感）", () => {
    expect(isAllowedExtension("model.RVT")).toBe(true);
    expect(isAllowedExtension("drawing.dwg")).toBe(true);
    expect(isAllowedExtension("family.rfa")).toBe(true);
    expect(isAllowedExtension("site.3dm")).toBe(true);
    expect(isAllowedExtension("concept.skp")).toBe(true);
    expect(isAllowedExtension("exchange.ifc")).toBe(true);
  });

  it("应拒绝白名单外扩展名", () => {
    expect(isAllowedExtension("malware.exe")).toBe(false);
    expect(isAllowedExtension("script.sh")).toBe(false);
    expect(isAllowedExtension("doc.pdf")).toBe(false);
    expect(isAllowedExtension("no-extension")).toBe(false);
  });
});

describe("MIME 类型白名单", () => {
  it("应允许设计文件 MIME 类型", () => {
    expect(isAllowedMimeType("application/acad")).toBe(true);
    expect(isAllowedMimeType("application/dxf")).toBe(true);
    expect(isAllowedMimeType("application/vnd.autodesk.revit")).toBe(true);
  });

  it("应拒绝非设计文件 MIME 类型", () => {
    expect(isAllowedMimeType("application/x-executable")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
  });
});

describe("魔数检测", () => {
  it("应识别 OLE CFB（RVT/RFA）", () => {
    const { magic, level } = detectMagic(OLE_CFB_MAGIC);
    expect(magic).toBe("ole-cfb");
    expect(level).toBe("strict");
  });

  it("应识别 DWG（AC10 版本头）", () => {
    const { magic, level } = detectMagic(DWG_HEADER);
    expect(magic).toBe("dwg");
    expect(level).toBe("strict");
  });

  it("应识别 DXF（文本 Section）", () => {
    const { magic, level } = detectMagic(DXF_HEADER);
    expect(magic).toBe("dxf");
    expect(level).toBe("strict");
  });

  it("应识别 IFC（ISO-10303-21）", () => {
    const { magic, level } = detectMagic(IFC_HEADER);
    expect(magic).toBe("ifc");
    expect(level).toBe("strict");
  });

  it("空 buffer 应返回 unknown", () => {
    const { magic, level } = detectMagic(Buffer.alloc(0));
    expect(magic).toBe("unknown");
    expect(level).toBe("unknown");
  });

  it("未知内容应返回 unknown", () => {
    const { magic, level } = detectMagic(Buffer.from("hello world", "ascii"));
    expect(magic).toBe("unknown");
    expect(level).toBe("unknown");
  });
});

describe("validateFile 完整校验", () => {
  it("合法 DWG 文件应通过全部校验", () => {
    const result = validateFile({
      fileName: "floor-plan.dwg",
      mimeType: "application/acad",
      size: DWG_HEADER.length,
      buffer: DWG_HEADER,
    });
    expect(result.valid).toBe(true);
    expect(result.magic).toBe("dwg");
    expect(result.magicLevel).toBe("strict");
    expect(result.errors).toEqual([]);
  });

  it("合法 RVT 文件应通过全部校验（OLE CFB 魔数）", () => {
    const result = validateFile({
      fileName: "building.rvt",
      mimeType: "application/vnd.autodesk.revit",
      size: OLE_CFB_MAGIC.length,
      buffer: OLE_CFB_MAGIC,
    });
    expect(result.valid).toBe(true);
    expect(result.magic).toBe("ole-cfb");
  });

  it("应拒绝白名单外扩展名", () => {
    const result = validateFile({
      fileName: "malware.exe",
      mimeType: "application/x-executable",
      size: DWG_HEADER.length,
      buffer: DWG_HEADER,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("INVALID_EXTENSION");
  });

  it("应拒绝空文件", () => {
    const result = validateFile({
      fileName: "empty.dwg",
      size: 0,
      buffer: Buffer.alloc(0),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("EMPTY_FILE");
  });

  it("应拒绝超限文件大小（SIZE_EXCEEDED）", () => {
    const result = validateFile(
      {
        fileName: "large.dwg",
        size: 2048,
        buffer: DWG_HEADER,
      },
      1024,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SIZE_EXCEEDED");
  });

  it("应拒绝 MIME 类型不匹配（INVALID_MIME）", () => {
    const result = validateFile({
      fileName: "drawing.dwg",
      mimeType: "text/html",
      size: DWG_HEADER.length,
      buffer: DWG_HEADER,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("INVALID_MIME");
  });

  it("应检测 polyglot 风险（扩展名与魔数不一致）", () => {
    // 文件名为 .rvt 但魔数实际是 DWG
    const result = validateFile({
      fileName: "fake.rvt",
      mimeType: "application/vnd.autodesk.revit",
      size: DWG_HEADER.length,
      buffer: DWG_HEADER,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("POLYGLOT_RISK");
  });

  it("应返回合法的 SHA-256 内容哈希", () => {
    const result = validateFile({
      fileName: "floor-plan.dwg",
      size: DWG_HEADER.length,
      buffer: DWG_HEADER,
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sha256).toBe(sha256(DWG_HEADER));
  });

  it("SKP 文件应宽松通过（无公开魔数，magicLevel=unknown）", () => {
    const result = validateFile({
      fileName: "concept.skp",
      size: 1024,
      buffer: Buffer.from("binary-skp-data-unknown-format"),
    });
    // SKP 无公开魔数：不强制魔数匹配，仅白名单/大小/非空校验
    expect(result.magicLevel).toBe("unknown");
    expect(result.valid).toBe(true);
  });
});

describe("路径穿越防护（security.md §6.3）", () => {
  const ROOT = "/data/uploads";

  it("应允许根目录内子路径", () => {
    expect(isPathSafe(ROOT, "project-a/model.rvt")).toBe(true);
    expect(isPathSafe(ROOT, "")).toBe(true);
  });

  it("应拒绝 .. 上跳路径", () => {
    expect(isPathSafe(ROOT, "../etc/passwd")).toBe(false);
    expect(isPathSafe(ROOT, "a/../../etc/passwd")).toBe(false);
  });

  it("应拒绝绝对路径", () => {
    expect(isPathSafe(ROOT, "/etc/passwd")).toBe(false);
  });
});

describe("zip bomb 启发式检测", () => {
  it("高压缩比应判定为疑似 zip bomb", () => {
    // 10MB 解压 / 1KB 压缩 = 10000:1 > 1000:1
    expect(isLikelyZipBomb(1024, 10 * 1024 * 1024)).toBe(true);
  });

  it("正常压缩比不应判定为 zip bomb", () => {
    // 10MB 解压 / 100KB 压缩 = 100:1 < 1000:1
    expect(isLikelyZipBomb(100 * 1024, 10 * 1024 * 1024)).toBe(false);
  });

  it("压缩大小为 0 应返回 false", () => {
    expect(isLikelyZipBomb(0, 1024)).toBe(false);
  });
});

describe("FileManifest 证据契约（D45.10）", () => {
  it("应通过合法 Manifest 校验", () => {
    const manifest = buildFileManifest({
      manifestId: "m-001",
      fileType: "design_source",
      objectUri: "https://minio.internal/design/model.rvt",
      hash: "a".repeat(64),
      tool: "bff-upload",
      version: "0.1.0",
      rawSummary: "Revit 建筑模型 v3",
      retention: "project_lifetime",
      classification: "L4",
      sizeBytes: 1024,
      fileName: "model.rvt",
    });
    const result = fileManifestSchema.safeParse(manifest);
    expect(result.success, JSON.stringify(result.error)).toBe(true);
  });

  it("应拒绝非法文件名（含路径分隔符）", () => {
    const manifest = buildFileManifest({
      manifestId: "m-001",
      fileType: "design_source",
      objectUri: "https://minio.internal/design/model.rvt",
      hash: "a".repeat(64),
      tool: "bff-upload",
      version: "0.1.0",
      rawSummary: "摘要",
      retention: "project_lifetime",
      classification: "L4",
      sizeBytes: 1024,
      fileName: "../../etc/passwd",
    });
    const result = fileManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("应拒绝非法哈希（非 64 位 hex）", () => {
    const manifest = buildFileManifest({
      manifestId: "m-001",
      fileType: "design_source",
      objectUri: "https://minio.internal/design/model.rvt",
      hash: "bad-hash",
      tool: "bff-upload",
      version: "0.1.0",
      rawSummary: "摘要",
      retention: "project_lifetime",
      classification: "L4",
      sizeBytes: 1024,
      fileName: "model.rvt",
    });
    const result = fileManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });
});
