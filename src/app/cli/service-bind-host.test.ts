import { describe, expect, it, vi, afterEach } from "bun:test";

import { resolveServiceBindHost } from "./service-bind-host.ts";
import * as bootstrapModule from "@freeanima/platform/config/bootstrap.ts";

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
