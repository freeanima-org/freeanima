import { describe, expect, it, vi, afterEach } from "bun:test";

import { resolveServiceBindHost, resolveServicePort } from "./service-bind-host.ts";
import * as bootstrapModule from "@freeanima/host/platform/config/bootstrap.ts";

describe("resolveServiceBindHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers CLI host over config", () => {
    vi.spyOn(bootstrapModule, "loadBootstrapConfig").mockReturnValue({
      database: { url: "postgresql://x" },
      http: { host: "0.0.0.0" },
    });
    expect(resolveServiceBindHost("127.0.0.1")).toBe("127.0.0.1");
  });

  it("reads http.host when CLI omitted", () => {
    vi.spyOn(bootstrapModule, "loadBootstrapConfig").mockReturnValue({
      database: { url: "postgresql://x" },
      http: { host: ["127.0.0.1", "10.244.0.2"] },
    });
    expect(resolveServiceBindHost()).toBe("127.0.0.1,10.244.0.2");
  });
});

describe("resolveServicePort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers CLI port over config", () => {
    vi.spyOn(bootstrapModule, "loadBootstrapConfig").mockReturnValue({
      database: { url: "postgresql://x" },
      http: { port: 2658 },
    });
    expect(resolveServicePort(19000)).toBe(19000);
  });

  it("reads http.port when CLI omitted", () => {
    vi.spyOn(bootstrapModule, "loadBootstrapConfig").mockReturnValue({
      database: { url: "postgresql://x" },
      http: { port: 18080 },
    });
    expect(resolveServicePort()).toBe(18080);
  });
});
