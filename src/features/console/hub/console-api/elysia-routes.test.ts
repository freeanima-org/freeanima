import { describe, it, expect } from "bun:test";
import { apiApp } from "./elysia/app.ts";

describe("elysia apiApp", () => {
  it("GET /api/health 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/health"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/status 已移除", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/status"));
    expect(res.status).toBe(404);
  });

  it("GET /api/echo 已移除", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/echo"));
    expect(res.status).toBe(404);
  });

  it("POST /api/tts/synthesize 路由已注册", async () => {
    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hi" }),
      }),
    );
    expect(res.status).not.toBe(404);
  });

  it("根路径 / 不在 apiApp 内", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/"));
    expect(res.status).toBe(404);
  });
});
