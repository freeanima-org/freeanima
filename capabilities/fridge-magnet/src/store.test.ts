import { describe, expect, it } from "bun:test";
import {
  clampTtl,
  deleteMagnet,
  getMagnet,
  magnetRedisKey,
  randomBase62,
  scanMagnets,
  setMagnet,
} from "./store.ts";

describe("magnetRedisKey", () => {
  it("三段命名空间", () => {
    expect(magnetRedisKey("session", "abc:r1a2")).toBe("fridge:session:abc:r1a2");
    expect(magnetRedisKey("tasks", "summary")).toBe("fridge:tasks:summary");
  });
});

describe("randomBase62", () => {
  it("生成长度为 4 的 base62 字符串", () => {
    const id = randomBase62(4);
    expect(id).toHaveLength(4);
    expect(id).toMatch(/^[0-9A-Za-z]{4}$/);
  });
});

describe("clampTtl", () => {
  it("默认 86400，最小 1，最大 86400", () => {
    expect(clampTtl()).toBe(86400);
    expect(clampTtl(0)).toBe(1);
    expect(clampTtl(100_000)).toBe(86400);
  });
});

describe("Redis 未初始化时静默降级", () => {
  it("setMagnet/getMagnet/deleteMagnet/scanMagnets 不抛错", async () => {
    await expect(setMagnet("session", "x:y", "v")).resolves.toBeUndefined();
    await expect(getMagnet("session", "x:y")).resolves.toBeNull();
    await expect(deleteMagnet("session", "x:y")).resolves.toBeUndefined();
    await expect(scanMagnets("fridge:session:*")).resolves.toEqual([]);
  });
});
