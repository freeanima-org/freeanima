import { describe, it, expect } from "bun:test";
import { resolveMcpServersRedirectUrl } from "./mcp-servers-redirect.ts";

describe("resolveMcpServersRedirectUrl", () => {
  it("maps /web/settings to /web/habitat/mcp", () => {
    expect(resolveMcpServersRedirectUrl("/web/settings")).toBe("/web/habitat/mcp");
  });

  it("maps nested settings path", () => {
    expect(resolveMcpServersRedirectUrl("/app/settings")).toBe("/app/habitat/mcp");
  });

  it("falls back when settings segment missing", () => {
    expect(resolveMcpServersRedirectUrl("/elsewhere")).toBe("/habitat/mcp");
  });
});
