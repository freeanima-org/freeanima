import { describe, it, expect } from "bun:test";
import {
  applyCorsToResponse,
  corsAllowOrigin,
  corsPreflightResponse,
  isBundledClientOrigin,
} from "./cors.ts";

describe("isBundledClientOrigin", () => {
  it("allows localhost and 127.0.0.1 with ports", () => {
    expect(isBundledClientOrigin("http://127.0.0.1:4175")).toBe(true);
    expect(isBundledClientOrigin("http://localhost")).toBe(true);
    expect(isBundledClientOrigin("https://localhost")).toBe(true);
    // 旧 Capacitor origin 已下线，不得再放行
    expect(isBundledClientOrigin("capacitor://localhost")).toBe(false);
    expect(isBundledClientOrigin("http://tauri.localhost")).toBe(true);
    expect(isBundledClientOrigin("https://tauri.localhost")).toBe(true);
    expect(isBundledClientOrigin("tauri://localhost")).toBe(true);
  });

  it("rejects arbitrary remote origins", () => {
    expect(isBundledClientOrigin("https://evil.example")).toBe(false);
    expect(isBundledClientOrigin(null)).toBe(false);
  });
});

describe("corsAllowOrigin", () => {
  it("returns origin when allowed", () => {
    expect(corsAllowOrigin("http://127.0.0.1:4175")).toBe("http://127.0.0.1:4175");
  });

  it("rejects non-bundled origins", () => {
    expect(corsAllowOrigin("https://app.anima.example.com")).toBeNull();
  });
});

describe("cors conditional GET headers", () => {
  it("preflight allows If-None-Match", () => {
    const res = corsPreflightResponse("http://127.0.0.1:5000");
    expect(res?.headers.get("Access-Control-Allow-Headers")).toContain("If-None-Match");
  });

  it("applyCorsToResponse exposes ETag", () => {
    const req = new Request("http://127.0.0.1:2658/rpc/v1/status", {
      headers: { Origin: "http://127.0.0.1:5000" },
    });
    const res = applyCorsToResponse(
      req,
      new Response(null, { status: 304, headers: { ETag: '"x"' } }),
    );
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("ETag");
  });
});
