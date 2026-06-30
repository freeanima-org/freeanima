import { describe, expect, it, vi, afterEach } from "bun:test";

import { resolveServiceBindHost } from "./service-bind-host.ts";
import { FileConfig } from "@freeanima/platform/config";

describe("resolveServiceBindHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers CLI host over config", () => {
    vi.spyOn(FileConfig, "open").mockReturnValue({
      data: { http: { host: "0.0.0.0" } },
    } as ReturnType<typeof FileConfig.open>);
    expect(resolveServiceBindHost("127.0.0.1")).toBe("127.0.0.1");
  });

  it("reads http.host when CLI omitted", () => {
    vi.spyOn(FileConfig, "open").mockReturnValue({
      data: { http: { host: ["127.0.0.1", "10.244.0.2"] } },
    } as ReturnType<typeof FileConfig.open>);
    expect(resolveServiceBindHost()).toBe("127.0.0.1,10.244.0.2");
  });
});
