import { All, Controller, Inject, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import type { ZodType } from "zod";
import {
  principalDtoSchema,
  organizationDtoSchema,
  membershipDtoSchema,
  roleBindingDtoSchema,
  accessGrantDtoSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";
import { proxyWithValidation, SchemaMatchRule } from "./iam-proxy.helpers";

/**
 * IAM 域代理控制器集合
 * 转发 /api/v1/principals、/api/v1/organizations、/api/v1/memberships、
 *      /api/v1/role-bindings、/api/v1/grants 到 Java Core Service
 *
 * 权威源：@design/D39-身份多租户-授权.md + @design/D35-API-事件契约.md §D35.15
 *
 * 契约验证策略：
 *  - 单实体创建/详情：严格验证，失败抛 500 阻断响应（PII 等级较高，避免脏数据落前端）
 *  - 列表/分页/未匹配路径：保持透传，软验证不阻断
 *  - 错误响应（非 2xx）：直接透传
 */

/** 主体 schema 匹配规则：POST /principals 创建、GET /principals/:id 详情 */
const PRINCIPAL_RULES: readonly SchemaMatchRule[] = [
  {
    method: "POST",
    pathRegex: /\/api\/v1\/principals\/?$/,
    schema: principalDtoSchema as ZodType<unknown>,
    operation: "principal.create",
  },
  {
    method: "GET",
    pathRegex: /\/api\/v1\/principals\/[^/]+$/,
    schema: principalDtoSchema as ZodType<unknown>,
    operation: "principal.getById",
  },
];

/** 组织 schema 匹配规则 */
const ORGANIZATION_RULES: readonly SchemaMatchRule[] = [
  {
    method: "POST",
    pathRegex: /\/api\/v1\/organizations\/?$/,
    schema: organizationDtoSchema as ZodType<unknown>,
    operation: "organization.create",
  },
  {
    method: "GET",
    pathRegex: /\/api\/v1\/organizations\/[^/]+$/,
    schema: organizationDtoSchema as ZodType<unknown>,
    operation: "organization.getById",
  },
];

/** 成员关系 schema 匹配规则（涉及 PII + 访问控制，需严格验证） */
const MEMBERSHIP_RULES: readonly SchemaMatchRule[] = [
  {
    method: "POST",
    pathRegex: /\/api\/v1\/memberships\/?$/,
    schema: membershipDtoSchema as ZodType<unknown>,
    operation: "membership.create",
  },
  {
    method: "GET",
    pathRegex: /\/api\/v1\/memberships\/[^/]+$/,
    schema: membershipDtoSchema as ZodType<unknown>,
    operation: "membership.getById",
  },
];

/** 角色绑定 schema 匹配规则 */
const ROLE_BINDING_RULES: readonly SchemaMatchRule[] = [
  {
    method: "POST",
    pathRegex: /\/api\/v1\/role-bindings\/?$/,
    schema: roleBindingDtoSchema as ZodType<unknown>,
    operation: "roleBinding.create",
  },
  {
    method: "GET",
    pathRegex: /\/api\/v1\/role-bindings\/[^/]+$/,
    schema: roleBindingDtoSchema as ZodType<unknown>,
    operation: "roleBinding.getById",
  },
];

/** 显式授权 schema 匹配规则 */
const GRANT_RULES: readonly SchemaMatchRule[] = [
  {
    method: "POST",
    pathRegex: /\/api\/v1\/grants\/?$/,
    schema: accessGrantDtoSchema as ZodType<unknown>,
    operation: "grant.create",
  },
  {
    method: "GET",
    pathRegex: /\/api\/v1\/grants\/[^/]+$/,
    schema: accessGrantDtoSchema as ZodType<unknown>,
    operation: "grant.getById",
  },
];

/** 主体代理控制器：转发 /api/v1/principals/** */
@Controller("v1/principals")
@UseInterceptors(ProxyInterceptor)
export class IamProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  @All()
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      PRINCIPAL_RULES,
    );
  }
}

/** 组织代理控制器：转发 /api/v1/organizations/** */
@Controller("v1/organizations")
@UseInterceptors(ProxyInterceptor)
export class OrganizationProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  @All()
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      ORGANIZATION_RULES,
    );
  }
}

/** 成员关系代理控制器：转发 /api/v1/memberships/** */
@Controller("v1/memberships")
@UseInterceptors(ProxyInterceptor)
export class MembershipProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  @All()
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      MEMBERSHIP_RULES,
    );
  }
}

/** 角色绑定代理控制器：转发 /api/v1/role-bindings/** */
@Controller("v1/role-bindings")
@UseInterceptors(ProxyInterceptor)
export class RoleBindingProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  @All()
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      ROLE_BINDING_RULES,
    );
  }
}

/** 显式授权代理控制器：转发 /api/v1/grants/** */
@Controller("v1/grants")
@UseInterceptors(ProxyInterceptor)
export class AccessGrantProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator)
    private readonly schemaValidator: SchemaValidator,
  ) {}

  @All()
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return proxyWithValidation(
      request,
      this.proxyService,
      this.schemaValidator,
      GRANT_RULES,
    );
  }
}
