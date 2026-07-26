import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/query-client";

describe("createQueryClient", () => {
  it("应该返回 QueryClient 实例", () => {
    const client = createQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  it("queries 默认 staleTime 应为 30s（30000ms）", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(30 * 1000);
  });

  it("queries 默认 retry 应为 1（避免付费 API 反复调用）", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.retry).toBe(1);
  });

  it("queries 默认 refetchOnWindowFocus 应为 false", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("mutations 默认 retry 应为 0（不重试）", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.mutations?.retry).toBe(0);
  });

  it("多次调用应返回独立实例", () => {
    const client1 = createQueryClient();
    const client2 = createQueryClient();
    expect(client1).not.toBe(client2);
  });
});
