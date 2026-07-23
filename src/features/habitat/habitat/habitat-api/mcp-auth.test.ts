import { describe, it, expect } from "bun:test";
import { isMcpPath } from "@freeanima/capabilities/mcp-server";

import { applyHttpAuth } from "./http-dispatch.ts";
import { createServiceAuthVerifier } from "./service-auth.ts";

describe("MCP /mcp service auth", () => {
  it("isMcpPath matches Habitat /mcp endpoint", () => {
    expect(isMcpPath("/mcp")).toBe(true);
  });

  it("rejects non-loopback without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://192.168.1.10:2658/mcp", { method: "POST" });
    const result = await applyHttpAuth(req, "192.168.1.10", verifier);
    expect(result.blocked?.status).toBe(401);
  });

  it("rejects loopback without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/mcp", { method: "POST" });
    const result = await applyHttpAuth(req, "127.0.0.1", verifier);
    expect(result.blocked?.status).toBe(401);
  });
});
