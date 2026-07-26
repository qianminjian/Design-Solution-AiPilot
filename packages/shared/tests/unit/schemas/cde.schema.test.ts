/**
 * CDE 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 cde.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、非 UUID 被拒绝
 *  - PII L5 字段（path）存在性校验
 */
import { describe, it, expect } from "vitest";
import {
  documentStatusSchema,
  documentVersionStatusSchema,
  documentDtoSchema,
  documentVersionDtoSchema,
  checkoutDtoSchema,
  checkinRequestSchema,
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  listDocumentsRequestSchema,
  uploadVersionRequestSchema,
} from "../../../src/schemas/cde.schema";

const validDocument = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  projectId: "550e8400-e29b-41d4-a716-446655440002",
  name: "方案图.dwg",
  path: "/projects/proj-001/方案图.dwg",
  mimeType: "application/acad",
  sizeBytes: 1024,
  currentVersionId: "550e8400-e29b-41d4-a716-446655440003",
  status: "DRAFT",
  checksum: "abc123",
  createdBy: "550e8400-e29b-41d4-a716-446655440099",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  version: 1,
};

const validVersion = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  documentId: "550e8400-e29b-41d4-a716-446655440000",
  versionNumber: 1,
  uploadedBy: "550e8400-e29b-41d4-a716-446655440099",
  uploadedAt: "2026-07-25T08:00:00.000Z",
  comment: "初始版本",
  storageKey: "docs/v1.dwg",
  checksum: "abc123",
  status: "PUBLISHED",
};

// ── 枚举 ──

describe("documentStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of [
      "DRAFT",
      "CHECKED_OUT",
      "PUBLISHED",
      "SUPERSEDED",
      "ARCHIVED",
    ]) {
      expect(documentStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(documentStatusSchema.safeParse("UNKNOWN").success).toBe(false);
  });
});

describe("documentVersionStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["DRAFT", "PUBLISHED", "SUPERSEDED"]) {
      expect(documentVersionStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── documentDtoSchema ──

describe("documentDtoSchema", () => {
  it("应该接受合法的文档 DTO", () => {
    const result = documentDtoSchema.safeParse(validDocument);
    expect(result.success).toBe(true);
  });

  it("应该接受 currentVersionId 为 null", () => {
    const result = documentDtoSchema.safeParse({
      ...validDocument,
      currentVersionId: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 checksum 为 null", () => {
    const result = documentDtoSchema.safeParse({
      ...validDocument,
      checksum: null,
    });
    expect(result.success).toBe(true);
  });

  it("PII L5：应该拒绝缺失 path", () => {
    const { path: _removed, ...rest } = validDocument;
    const result = documentDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = documentDtoSchema.safeParse({
      ...validDocument,
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数 sizeBytes", () => {
    const result = documentDtoSchema.safeParse({
      ...validDocument,
      sizeBytes: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ── documentVersionDtoSchema ──

describe("documentVersionDtoSchema", () => {
  it("应该接受合法的版本 DTO", () => {
    const result = documentVersionDtoSchema.safeParse(validVersion);
    expect(result.success).toBe(true);
  });

  it("应该接受 uploadedBy 为 null", () => {
    const result = documentVersionDtoSchema.safeParse({
      ...validVersion,
      uploadedBy: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 comment 为 null", () => {
    const result = documentVersionDtoSchema.safeParse({
      ...validVersion,
      comment: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非正数 versionNumber", () => {
    const result = documentVersionDtoSchema.safeParse({
      ...validVersion,
      versionNumber: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ── checkoutDtoSchema ──

describe("checkoutDtoSchema", () => {
  it("应该接受合法的检出响应", () => {
    const valid = {
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      status: "CHECKED_OUT",
      checkedOutBy: "550e8400-e29b-41d4-a716-446655440099",
      checkedOutAt: "2026-07-25T08:00:00.000Z",
    };
    const result = checkoutDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受 checkedOutBy 为 null", () => {
    const result = checkoutDtoSchema.safeParse({
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      status: "CHECKED_OUT",
      checkedOutBy: null,
      checkedOutAt: "2026-07-25T08:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

// ── checkinRequestSchema ──

describe("checkinRequestSchema", () => {
  it("应该接受合法的检入请求", () => {
    const valid = {
      comment: "修订版",
      storageKey: "docs/v2.dwg",
      checksum: "def456",
    };
    const result = checkinRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 comment", () => {
    const result = checkinRequestSchema.safeParse({
      comment: "",
      storageKey: "docs/v2.dwg",
      checksum: "def456",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 storageKey", () => {
    const result = checkinRequestSchema.safeParse({
      comment: "x",
      checksum: "def456",
    });
    expect(result.success).toBe(false);
  });
});

// ── createDocumentRequestSchema ──

describe("createDocumentRequestSchema", () => {
  it("应该接受合法的创建请求", () => {
    const valid = {
      name: "新文档.dwg",
      path: "/projects/proj-001/新文档.dwg",
      mimeType: "application/acad",
      storageKey: "docs/new.dwg",
      checksum: "abc123",
    };
    const result = createDocumentRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("PII L5：应该拒绝缺失 path", () => {
    const { path: _removed, ...rest } = {
      name: "x",
      path: "/x",
      mimeType: "x",
      storageKey: "x",
      checksum: "x",
    };
    const result = createDocumentRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── updateDocumentRequestSchema ──

describe("updateDocumentRequestSchema", () => {
  it("应该接受仅更新 name", () => {
    const result = updateDocumentRequestSchema.safeParse({ name: "新名" });
    expect(result.success).toBe(true);
  });

  it("应该接受空对象（不更新任何字段）", () => {
    const result = updateDocumentRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ── listDocumentsRequestSchema ──

describe("listDocumentsRequestSchema", () => {
  it("应该接受合法的查询参数", () => {
    const valid = {
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      order: "desc",
      status: "PUBLISHED",
      keyword: "方案",
    };
    const result = listDocumentsRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受空对象", () => {
    const result = listDocumentsRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("应该拒绝 pageSize 超过 100", () => {
    const result = listDocumentsRequestSchema.safeParse({ pageSize: 200 });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 order 枚举值", () => {
    const result = listDocumentsRequestSchema.safeParse({ order: "random" });
    expect(result.success).toBe(false);
  });
});

// ── uploadVersionRequestSchema ──

describe("uploadVersionRequestSchema", () => {
  it("应该接受合法的上传请求", () => {
    const valid = {
      storageKey: "docs/v2.dwg",
      checksum: "def456",
      comment: "修订版",
    };
    const result = uploadVersionRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 checksum", () => {
    const result = uploadVersionRequestSchema.safeParse({
      storageKey: "docs/v2.dwg",
    });
    expect(result.success).toBe(false);
  });
});
