import { describe, expect, it } from "bun:test";
import {
  clampTtl,
  deleteMagnet,
  FRIDGE_MAGNET_SCAN_PATTERN,
  getMagnet,
  magnetRedisKey,
  randomBase62,
  scanMagnets,
  setMagnet,
} from "./store.ts";

describe("magnetRedisKey", () => {
  it("three-part namespace", () => {
    expect(magnetRedisKey("session", "abc:r1a2")).toBe("fridge-magnet:session:abc:r1a2");
    expect(magnetRedisKey("tasks", "summary")).toBe("fridge-magnet:tasks:summary");
  });
});

describe("randomBase62", () => {
  it("generates 4-char base62 string", () => {
    const id = randomBase62(4);
    expect(id).toHaveLength(4);
    expect(id).toMatch(/^[0-9A-Za-z]{4}$/);
  });
});

describe("clampTtl", () => {
  it("default 86400, min 1, max 86400", () => {
    expect(clampTtl()).toBe(86400);
    expect(clampTtl(0)).toBe(1);
    expect(clampTtl(100_000)).toBe(86400);
  });
});

describe("silent degradation when Redis is not initialized", () => {
  it("setMagnet/getMagnet/deleteMagnet/scanMagnets do not throw", async () => {
    await expect(setMagnet("session", "x:y", "v")).resolves.toBeUndefined();
    await expect(getMagnet("session", "x:y")).resolves.toBeNull();
    await expect(deleteMagnet("session", "x:y")).resolves.toBeUndefined();
    await expect(
      scanMagnets(`${FRIDGE_MAGNET_SCAN_PATTERN.slice(0, -1)}session:*`),
    ).resolves.toEqual([]);
  });
});
