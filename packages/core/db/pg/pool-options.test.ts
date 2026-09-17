import { describe, expect, it } from "bun:test";

import {
  DEFAULT_PG_POOL_HEAL_INTERVAL_MS,
  DEFAULT_PG_POOL_MAX_LIFETIME_SEC,
  resolvePoolOptions,
} from "./pool-options.ts";

describe("resolvePoolOptions", () => {
  it("defaults maxLifetime and heal interval when env unset", () => {
    const opts = resolvePoolOptions({});
    expect(opts.max).toBe(10);
    expect(opts.idleTimeout).toBe(0);
    expect(opts.maxLifetime).toBe(DEFAULT_PG_POOL_MAX_LIFETIME_SEC);
    expect(opts.healIntervalMs).toBe(DEFAULT_PG_POOL_HEAL_INTERVAL_MS);
  });

  it("honors explicit maxLifetime=0 and healIntervalMs=0", () => {
    const opts = resolvePoolOptions({
      FREEANIMA_PG_POOL_MAX_LIFETIME: "0",
      FREEANIMA_PG_POOL_HEAL_INTERVAL_MS: "0",
    });
    expect(opts.maxLifetime).toBe(0);
    expect(opts.healIntervalMs).toBe(0);
  });

  it("parses positive overrides", () => {
    const opts = resolvePoolOptions({
      FREEANIMA_PG_POOL_MAX: "4",
      FREEANIMA_PG_POOL_IDLE_TIMEOUT: "0",
      FREEANIMA_PG_POOL_MAX_LIFETIME: "120",
      FREEANIMA_PG_POOL_HEAL_INTERVAL_MS: "5000",
    });
    expect(opts).toEqual({
      max: 4,
      idleTimeout: 0,
      maxLifetime: 120,
      healIntervalMs: 5000,
    });
  });

  it("falls back on invalid numbers", () => {
    const opts = resolvePoolOptions({
      FREEANIMA_PG_POOL_MAX: "nope",
      FREEANIMA_PG_POOL_MAX_LIFETIME: "-3",
      FREEANIMA_PG_POOL_HEAL_INTERVAL_MS: "x",
    });
    expect(opts.max).toBe(10);
    expect(opts.maxLifetime).toBe(DEFAULT_PG_POOL_MAX_LIFETIME_SEC);
    expect(opts.healIntervalMs).toBe(DEFAULT_PG_POOL_HEAL_INTERVAL_MS);
  });
});
