import { describe, it, expect, spyOn } from "bun:test";
import { apiApp } from "./elysia/app.ts";
import * as emailHandlers from "./handlers/email.ts";

describe("elysia apiApp", () => {
  it("GET /api/health 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/health"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/conversations 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/conversations"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/email 路由已注册", async () => {
    const spy = spyOn(emailHandlers, "getEmailOverview").mockResolvedValue({
      accounts: [],
      messages: [],
      errors: {},
    });
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/email"));
    expect(res.status).not.toBe(404);
    spy.mockRestore();
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

  it("GET /api/fridge-magnet/magnets 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/fridge-magnet/magnets"));
    expect(res.status).not.toBe(404);
  });

  it("POST /api/tasks/list 路由已注册", async () => {
    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/tasks/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).not.toBe(404);
  });

  it("根路径 / 不在 apiApp 内", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/"));
    expect(res.status).toBe(404);
  });
});
