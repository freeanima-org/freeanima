import { describe, it, expect } from "bun:test";
import { createRemoteAuthVerifier, isLocalDirectConnection } from "./remote-auth.ts";
import { isMcpPath } from "@freeanima/capabilities-mcp-server";

describe("MCP /mcp remote auth", () => {
  it("isMcpPath matches hub endpoint", () => {
    expect(isMcpPath("/mcp")).toBe(true);
  });

  it("rejects non-loopback without token", async () => {
    const verifier = createRemoteAuthVerifier({ token: "test-token-1234567890" });
    const req = new Request("http://192.168.1.10:2658/mcp", { method: "POST" });
    const blocked = await verifier.verifyRequest(req, "192.168.1.10");
    expect(blocked?.status).toBe(401);
  });

  it("allows loopback direct without token", () => {
    const req = new Request("http://127.0.0.1:2658/mcp", { method: "POST" });
    expect(isLocalDirectConnection(req, "127.0.0.1")).toBe(true);
  });
});
