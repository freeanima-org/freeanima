import { describe, expect, test } from "bun:test";
import {
  applyHttpAuth,
  handleHubCorsPreflight,
  isHubApiPath,
  trySapWebSocketUpgrade,
} from "./http-dispatch.ts";
import { createServiceAuthVerifier } from "./service-auth.ts";

describe("http-dispatch", () => {
  test("isHubApiPath", () => {
    expect(isHubApiPath("/")).toBe(true);
    expect(isHubApiPath("/api")).toBe(true);
    expect(isHubApiPath("/api/")).toBe(true);
    expect(isHubApiPath("/api/health")).toBe(true);
    expect(isHubApiPath("/hub/rpc/v1")).toBe(false);
  });

  test("applyHttpAuth allows GET /api/health without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/health");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
  });

  test("applyHttpAuth allows GET /api/health on public host without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/api/health");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
  });

  test("applyHttpAuth blocks without token for status", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/api/status");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked?.status).toBe(401);
  });

  test("applyHttpAuth blocks loopback status without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/status");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked?.status).toBe(401);
  });

  test("handleHubCorsPreflight returns 204 for Capacitor origin", () => {
    const req = new Request("https://hub.example.com/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    const res = handleHubCorsPreflight(req);
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://localhost");
  });

  test("applyHttpAuth allows OPTIONS preflight without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    const result = await applyHttpAuth(req, "10.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
  });

  test("applyHttpAuth preserves POST body after async token verification", async () => {
    const serviceAuth: import("./service-auth.ts").ServiceAuthVerifier = {
      async verifyRequest() {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 5);
        });
        return {
          blocked: null,
          auth: {
            token_id: 1,
            subject_id: 53,
            subject_type: "user",
            scopes: ["full"],
          },
        };
      },
    };
    const req = new Request("http://127.0.0.1:2658/api/subjects/53/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "auth-body-test" }),
    });
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
    expect(await result.req.json()).toEqual({ name: "auth-body-test" });
    expect(result.req.headers.get("x-anima-auth-subject-id")).toBe("53");
    expect(result.req.headers.get("x-anima-remote-address")).toBe("127.0.0.1");
  });

  test("trySapWebSocketUpgrade upgrades /hub/rpc/v1 synchronously", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req, bunServer) {
        const upgraded = trySapWebSocketUpgrade(req, bunServer, {
          fetch(innerReq, innerServer) {
            const upgradeServer = innerServer as Bun.Server<unknown>;
            if (upgradeServer.upgrade(innerReq, { data: {} })) return;
            return new Response("Expected WebSocket upgrade", { status: 426 });
          },
        });
        if (upgraded != null) return upgraded;
        return new Response("not found", { status: 404 });
      },
      websocket: {
        open() {},
        message() {},
        close() {},
      },
    });

    try {
      const port = server.port!;
      const ws = new WebSocket(`ws://127.0.0.1:${port}/hub/rpc/v1`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebSocket open timeout")), 3000);
        ws.addEventListener(
          "open",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        ws.addEventListener(
          "error",
          () => {
            clearTimeout(timer);
            reject(new Error("WebSocket upgrade failed"));
          },
          { once: true },
        );
      });
      ws.close();
    } finally {
      server.stop(true);
    }
  });
});
