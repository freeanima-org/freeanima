import { describe, it, expect } from "bun:test";
import { apiApp } from "./elysia/app.ts";

describe("elysia apiApp", () => {
  it("GET /api/health 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/health"));
    expect(res.status).not.toBe(404);
  });

  it("POST /api/echo 原文回显请求", async () => {
    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/echo?probe=1", {
        method: "POST",
        headers: { "Content-Type": "text/plain", "X-Echo": "yes" },
        body: "ping",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      method: string;
      host: string;
      pathname: string;
      search: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(body.method).toBe("POST");
    expect(body.host).toBe("127.0.0.1");
    expect(body.pathname).toBe("/api/echo");
    expect(body.search).toBe("?probe=1");
    expect(body.headers["x-echo"]).toBe("yes");
    expect(body.body).toBe("ping");
  });

  it("GET /api/conversations 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/conversations"));
    expect(res.status).not.toBe(404);
  });

  it("GET /api/email 已移除", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/email"));
    expect(res.status).toBe(404);
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

  it("GET /api/fridge-magnet/magnets 已移除", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/fridge-magnet/magnets"));
    expect(res.status).toBe(404);
  });

  it("GET /api/task/lists 已移除", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/task/lists"));
    expect(res.status).toBe(404);
  });

  it("GET /api/subjects/:id/tokens 路由已注册", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/api/subjects/1/tokens"));
    expect(res.status).not.toBe(404);
  });

  it("根路径 / 不在 apiApp 内", async () => {
    const res = await apiApp.handle(new Request("http://127.0.0.1/"));
    expect(res.status).toBe(404);
  });
});
