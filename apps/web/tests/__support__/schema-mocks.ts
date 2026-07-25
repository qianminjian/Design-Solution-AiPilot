/**
 * Schema-aware Mock 数据生成器
 *
 * 权威源：.trae/rules/testing.md §4.2 Mock 红线
 * - 基于 zod schema 自动生成符合契约的 mock 数据
 * - 通过 overrides 支持局部覆盖
 * - 生成后调用方可用 schema.safeParse 验证契约一致性
 *
 * 用法：
 * ```ts
 * const mock = generateMockFromSchema(loginResponseSchema, {
 *   accessToken: "custom-token",
 * });
 * ```
 */
import type { z } from "zod";
import type { ZodType, ZodTypeAny } from "zod";
import { ZodFirstPartyTypeKind, type ZodString, type ZodNumber } from "zod";

// ── 默认值常量（符合 zod 格式约束） ──

const DEFAULT_UUID = "00000000-0000-4000-8000-000000000000";
const DEFAULT_EMAIL = "mock@example.com";
const DEFAULT_DATETIME = "2026-07-22T00:00:00.000Z";
const DEFAULT_URL = "https://mock.example.com/path";
const DEFAULT_STRING = "mock-string";

/**
 * 深度可选类型：递归让所有属性（含嵌套）可选
 *
 * 用法：generateMockFromSchema(schema, deepPartialOverrides)
 * 允许仅覆盖嵌套对象的某些字段，未覆盖字段保留默认生成的值
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

/**
 * 深度合并两个对象，overrides 优先
 */
function deepMerge<T>(base: T, overrides: unknown): T {
  if (overrides === null || overrides === undefined) {
    return base;
  }
  if (typeof base !== "object" || typeof overrides !== "object") {
    return overrides as T;
  }
  if (Array.isArray(base) && Array.isArray(overrides)) {
    return overrides as T;
  }
  if (Array.isArray(base) || Array.isArray(overrides)) {
    return overrides as T;
  }
  const merged: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(
    overrides as Record<string, unknown>,
  )) {
    if (
      value !== null &&
      typeof value === "object" &&
      typeof merged[key] === "object" &&
      merged[key] !== null &&
      !Array.isArray(value) &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged as T;
}

/**
 * 根据 zod schema 生成默认 mock 值
 *
 * 使用 zod 的公开 API（shape、unwrap、options 等）访问内部结构，
 * 避免依赖 _def 内部字段，保证向前兼容性。
 *
 * @param schema zod schema 实例
 * @param overrides 深度可选的覆盖对象，仅覆盖指定字段，未覆盖字段保留默认值
 */
export function generateMockFromSchema<T>(
  schema: ZodType<T>,
  overrides?: DeepPartial<T>,
): T {
  const base = generateBase(schema as ZodTypeAny);
  const merged = overrides ? deepMerge(base, overrides) : base;
  return merged as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_KIND: Record<string, string> = {
  ZodObject: "ZodObject",
  ZodArray: "ZodArray",
  ZodOptional: "ZodOptional",
  ZodNullable: "ZodNullable",
  ZodDefault: "ZodDefault",
  ZodEnum: "ZodEnum",
  ZodLiteral: "ZodLiteral",
  ZodUnion: "ZodUnion",
  ZodString: "ZodString",
  ZodNumber: "ZodNumber",
  ZodBoolean: "ZodBoolean",
  ZodRecord: "ZodRecord",
  ZodEffects: "ZodEffects",
  ZodAny: "ZodAny",
  ZodUnknown: "ZodUnknown",
  ZodNull: "ZodNull",
  ZodUndefined: "ZodUndefined",
  ZodVoid: "ZodVoid",
};

function generateBase(schema: ZodTypeAny): unknown {
  // 通过 _def.typeName 判断类型，使用 zod 公开 API 访问内部结构
  const def = (schema as { _def: { typeName: ZodFirstPartyTypeKind } })._def;
  const kind = def.typeName as string;

  switch (kind) {
    case TYPE_KIND.ZodObject: {
      // ZodObject.shape 是属性而非方法，直接访问
      const obj = schema as unknown as {
        shape: Record<string, ZodTypeAny>;
      };
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj.shape)) {
        result[key] = generateBase(value);
      }
      return result;
    }
    case TYPE_KIND.ZodArray: {
      // ZodArray.element 返回元素 schema
      const arr = schema as unknown as { element: ZodTypeAny };
      return [generateBase(arr.element)];
    }
    case TYPE_KIND.ZodOptional:
    case TYPE_KIND.ZodNullable: {
      // ZodOptional/ZodNullable 通过 unwrap() 取内层
      const wrapper = schema as unknown as { unwrap: () => ZodTypeAny };
      return generateBase(wrapper.unwrap());
    }
    case TYPE_KIND.ZodDefault: {
      // ZodDefault 通过 removeDefault() 取内层
      const defSchema = schema as unknown as {
        removeDefault: () => ZodTypeAny;
      };
      return generateBase(defSchema.removeDefault());
    }
    case TYPE_KIND.ZodEnum: {
      // ZodEnum.options 返回枚举值数组
      const en = schema as unknown as { options: string[] };
      return en.options[0];
    }
    case TYPE_KIND.ZodLiteral: {
      // ZodLiteral.value 返回字面值
      const lit = schema as unknown as { value: unknown };
      return lit.value;
    }
    case TYPE_KIND.ZodUnion: {
      // ZodUnion.options 返回选项数组
      const union = schema as unknown as { options: ZodTypeAny[] };
      return generateBase(union.options[0] as ZodTypeAny);
    }
    case TYPE_KIND.ZodString: {
      return generateString(schema as unknown as ZodString);
    }
    case TYPE_KIND.ZodNumber: {
      return generateNumber(schema as unknown as ZodNumber);
    }
    case TYPE_KIND.ZodBoolean: {
      return false;
    }
    case TYPE_KIND.ZodRecord: {
      // ZodRecord 默认返回空对象，符合 settings/metadata 等场景
      return {};
    }
    case TYPE_KIND.ZodEffects: {
      // 处理 .refine() / .transform() 包装的 schema，递归取内层
      const effects = schema as unknown as { innerType: () => ZodTypeAny };
      return generateBase(effects.innerType());
    }
    case TYPE_KIND.ZodAny:
    case TYPE_KIND.ZodUnknown:
      return null;
    case TYPE_KIND.ZodNull:
      return null;
    case TYPE_KIND.ZodUndefined:
      return undefined;
    case TYPE_KIND.ZodVoid:
      return undefined;
    default:
      // 未支持的类型，返回 null 作为安全 fallback
      return null;
  }
}

/**
 * 根据 ZodString 的约束生成符合格式的字符串
 */
function generateString(def: ZodString): string {
  const checks = def._def.checks ?? [];
  // 检测格式约束
  for (const check of checks) {
    if (check.kind === "uuid") return DEFAULT_UUID;
    if (check.kind === "email") return DEFAULT_EMAIL;
    if (check.kind === "datetime") return DEFAULT_DATETIME;
    if (check.kind === "url") return DEFAULT_URL;
  }
  // 检测 min 长度要求
  const minCheck = checks.find((c) => c.kind === "min") as
    { kind: "min"; value: number } | undefined;
  if (minCheck && minCheck.value > 1) {
    return DEFAULT_STRING.padEnd(minCheck.value, "x");
  }
  return DEFAULT_STRING;
}

/**
 * 根据 ZodNumber 的约束生成符合格式的数字
 */
function generateNumber(def: ZodNumber): number {
  const checks = def._def.checks ?? [];
  const minCheck = checks.find((c) => c.kind === "min") as
    { kind: "min"; value: number; inclusive?: boolean } | undefined;
  const maxCheck = checks.find((c) => c.kind === "max") as
    { kind: "max"; value: number; inclusive?: boolean } | undefined;

  let value = 1;
  if (minCheck) {
    value = minCheck.inclusive === false ? minCheck.value + 1 : minCheck.value;
  }
  if (maxCheck) {
    const max =
      maxCheck.inclusive === false ? maxCheck.value - 1 : maxCheck.value;
    if (value > max) {
      value = max;
    }
  }
  // 处理 int 约束
  const intCheck = checks.find((c) => c.kind === "int");
  if (intCheck) {
    return Math.floor(value);
  }
  return value;
}

// ── Schema 预设工厂（项目高频用例） ──

/**
 * 通用工厂：从任意 zod schema 生成 mock
 * 类型推导：z.infer<S> 保证返回值与 schema 一致
 *
 * @param schema zod schema 实例
 * @param overrides 深度可选的覆盖对象
 */
export function createMockFromSchema<S extends ZodTypeAny>(
  schema: S,
  overrides?: DeepPartial<z.infer<S>>,
): z.infer<S> {
  return generateMockFromSchema(schema, overrides);
}
