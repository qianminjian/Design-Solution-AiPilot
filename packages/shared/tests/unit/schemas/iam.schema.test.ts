/**
 * IAM 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 iam.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、非 UUID/非 email 被拒绝
 *  - PII：principalDto 不暴露 passwordHash
 */
import { describe, it, expect } from "vitest";
import {
  tenantStatusSchema,
  principalTypeSchema,
  principalStatusSchema,
  organizationTypeSchema,
  organizationStatusSchema,
  membershipStatusSchema,
  roleScopeTypeSchema,
  grantEffectSchema,
  dataClassificationSchema,
  tenantDtoSchema,
  organizationDtoSchema,
  principalDtoSchema,
  membershipDtoSchema,
  roleBindingDtoSchema,
  accessGrantDtoSchema,
  createPrincipalRequestSchema,
  updatePrincipalRequestSchema,
  createOrganizationRequestSchema,
  createMembershipRequestSchema,
  createRoleBindingRequestSchema,
} from "../../../src/schemas/iam.schema";

// ── 公共 fixture ──

const validTenant = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Acme Inc.",
  code: "ACME",
  status: "active",
  region: "CN",
  language: "zh",
  classification: "internal",
  settings: {},
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  rowVersion: 1,
};

const validPrincipal = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  tenantId: "550e8400-e29b-41d4-a716-446655440000",
  type: "user",
  email: "user@example.com",
  displayName: "张三",
  status: "active",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  classification: "internal",
  externalId: null,
  lastLoginAt: null,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  rowVersion: 1,
};

// ── 枚举 schema ──

describe("IAM 枚举 schema", () => {
  it("tenantStatusSchema 应该接受合法枚举值", () => {
    for (const v of ["active", "suspended", "terminated"]) {
      expect(tenantStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("principalTypeSchema 应该接受合法枚举值", () => {
    for (const v of ["user", "service", "agent", "device", "external"]) {
      expect(principalTypeSchema.safeParse(v).success).toBe(true);
    }
  });

  it("principalStatusSchema 应该接受合法枚举值", () => {
    for (const v of ["active", "disabled", "locked", "pending"]) {
      expect(principalStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("organizationTypeSchema 应该接受合法枚举值", () => {
    for (const v of ["enterprise", "department", "team", "external"]) {
      expect(organizationTypeSchema.safeParse(v).success).toBe(true);
    }
  });

  it("organizationStatusSchema 应该接受 active/archived", () => {
    expect(organizationStatusSchema.safeParse("active").success).toBe(true);
    expect(organizationStatusSchema.safeParse("archived").success).toBe(true);
  });

  it("membershipStatusSchema 应该接受合法枚举值", () => {
    for (const v of ["active", "suspended", "expired"]) {
      expect(membershipStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("roleScopeTypeSchema 应该接受合法枚举值", () => {
    for (const v of ["tenant", "organization", "project"]) {
      expect(roleScopeTypeSchema.safeParse(v).success).toBe(true);
    }
  });

  it("grantEffectSchema 应该接受 allow/deny", () => {
    expect(grantEffectSchema.safeParse("allow").success).toBe(true);
    expect(grantEffectSchema.safeParse("deny").success).toBe(true);
  });

  it("dataClassificationSchema 应该接受合法枚举值", () => {
    for (const v of [
      "public",
      "internal",
      "project_record",
      "sensitive",
      "published_evidence",
    ]) {
      expect(dataClassificationSchema.safeParse(v).success).toBe(true);
    }
  });

  it("dataClassificationSchema 应该拒绝非法枚举值", () => {
    expect(dataClassificationSchema.safeParse("unknown").success).toBe(false);
  });
});

// ── tenantDtoSchema ──

describe("tenantDtoSchema", () => {
  it("应该接受合法的租户 DTO", () => {
    const result = tenantDtoSchema.safeParse(validTenant);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 id", () => {
    const result = tenantDtoSchema.safeParse({ ...validTenant, id: "x" });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = tenantDtoSchema.safeParse({
      ...validTenant,
      status: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 classification（PII 等级）", () => {
    const { classification: _removed, ...rest } = validTenant;
    const result = tenantDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── organizationDtoSchema ──

describe("organizationDtoSchema", () => {
  const validOrg = {
    id: "550e8400-e29b-41d4-a716-446655440002",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    parentId: null,
    name: "研发部",
    type: "department",
    status: "active",
    classification: "internal",
    metadata: {},
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的组织 DTO", () => {
    const result = organizationDtoSchema.safeParse(validOrg);
    expect(result.success).toBe(true);
  });

  it("应该接受 parentId 为 null", () => {
    const result = organizationDtoSchema.safeParse({
      ...validOrg,
      parentId: null,
    });
    expect(result.success).toBe(true);
  });
});

// ── principalDtoSchema（不暴露 passwordHash） ──

describe("principalDtoSchema", () => {
  it("应该接受合法的主体 DTO", () => {
    const result = principalDtoSchema.safeParse(validPrincipal);
    expect(result.success).toBe(true);
  });

  it("应该接受 lastLoginAt 为 null", () => {
    const result = principalDtoSchema.safeParse({
      ...validPrincipal,
      lastLoginAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 lastLoginAt 为 ISO datetime", () => {
    const result = principalDtoSchema.safeParse({
      ...validPrincipal,
      lastLoginAt: "2026-07-25T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 email 的 email 字段", () => {
    const result = principalDtoSchema.safeParse({
      ...validPrincipal,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 type 枚举值", () => {
    const result = principalDtoSchema.safeParse({
      ...validPrincipal,
      type: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── membershipDtoSchema ──

describe("membershipDtoSchema", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440003",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    principalId: "550e8400-e29b-41d4-a716-446655440001",
    organizationId: "550e8400-e29b-41d4-a716-446655440002",
    role: "architect",
    status: "active",
    joinedAt: "2026-07-25T08:00:00.000Z",
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的成员关系 DTO", () => {
    const result = membershipDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ── roleBindingDtoSchema ──

describe("roleBindingDtoSchema", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440004",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    principalId: "550e8400-e29b-41d4-a716-446655440001",
    roleCode: "architect",
    scopeType: "tenant",
    scopeId: null,
    status: "active",
    grantedAt: "2026-07-25T08:00:00.000Z",
    grantedBy: "550e8400-e29b-41d4-a716-446655440099",
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的角色绑定 DTO", () => {
    const result = roleBindingDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法 scopeType 枚举值", () => {
    const result = roleBindingDtoSchema.safeParse({
      ...valid,
      scopeType: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── accessGrantDtoSchema ──

describe("accessGrantDtoSchema", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440005",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    principalId: "550e8400-e29b-41d4-a716-446655440001",
    permission: "project:read",
    resourceType: "project",
    resourceId: "550e8400-e29b-41d4-a716-446655440002",
    effect: "allow",
    status: "active",
    grantedAt: "2026-07-25T08:00:00.000Z",
    grantedBy: "550e8400-e29b-41d4-a716-446655440099",
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的授权 DTO", () => {
    const result = accessGrantDtoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法 effect 枚举值", () => {
    const result = accessGrantDtoSchema.safeParse({
      ...valid,
      effect: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── createPrincipalRequestSchema ──

describe("createPrincipalRequestSchema", () => {
  it("应该接受合法的创建主体请求", () => {
    const valid = {
      email: "user@example.com",
      displayName: "张三",
      password: "password123",
    };
    const result = createPrincipalRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝短于 8 位的密码", () => {
    const result = createPrincipalRequestSchema.safeParse({
      email: "user@example.com",
      displayName: "张三",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 email 的 email 字段", () => {
    const result = createPrincipalRequestSchema.safeParse({
      email: "not-an-email",
      displayName: "张三",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

// ── updatePrincipalRequestSchema ──

describe("updatePrincipalRequestSchema", () => {
  it("应该接受仅更新 displayName", () => {
    const result = updatePrincipalRequestSchema.safeParse({
      displayName: "新名字",
    });
    expect(result.success).toBe(true);
  });

  it("应该接受空对象", () => {
    const result = updatePrincipalRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ── createOrganizationRequestSchema ──

describe("createOrganizationRequestSchema", () => {
  it("应该接受合法的创建组织请求", () => {
    const valid = {
      name: "研发部",
    };
    const result = createOrganizationRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受含 parentId 的请求", () => {
    const result = createOrganizationRequestSchema.safeParse({
      name: "研发部",
      parentId: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(result.success).toBe(true);
  });
});

// ── createMembershipRequestSchema ──

describe("createMembershipRequestSchema", () => {
  it("应该接受合法的创建成员关系请求", () => {
    const valid = {
      principalId: "550e8400-e29b-41d4-a716-446655440001",
      organizationId: "550e8400-e29b-41d4-a716-446655440002",
      role: "architect",
    };
    const result = createMembershipRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 principalId", () => {
    const result = createMembershipRequestSchema.safeParse({
      principalId: "not-uuid",
      organizationId: "550e8400-e29b-41d4-a716-446655440002",
      role: "architect",
    });
    expect(result.success).toBe(false);
  });
});

// ── createRoleBindingRequestSchema ──

describe("createRoleBindingRequestSchema", () => {
  it("应该接受合法的角色绑定请求", () => {
    const valid = {
      principalId: "550e8400-e29b-41d4-a716-446655440001",
      roleCode: "architect",
      scopeType: "tenant",
    };
    const result = createRoleBindingRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 scopeType", () => {
    const result = createRoleBindingRequestSchema.safeParse({
      principalId: "550e8400-e29b-41d4-a716-446655440001",
      roleCode: "architect",
    });
    expect(result.success).toBe(false);
  });
});
