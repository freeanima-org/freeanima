import { describe, it, expect } from "bun:test";
import { apiApp } from "./elysia/app.ts";

describe("elysia apiApp", () => {
  it("GET /api/health 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/health"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/sessions 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/sessions"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/email 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/email"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/email/:accountId/messages 路由已注册", async () => {
    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/email/test-account/messages"),
    );
    expect(res.status).not.toBe(404);
  });

  it("GET /api/credentials/detail 路由已注册", async () => {
    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/credentials/detail?path=test/path"),
    );
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text.toLowerCase()).toContain("not found");
  });

  it("GET /api/prompt/debug 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/prompt/debug"));
    expect(res.status).not.toBe(404);
  });

  it("根路径 / 不在 apiApp 内", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/"));
    expect(res.status).toBe(404);
  });
});
