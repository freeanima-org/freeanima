import { describe, expect, test } from "bun:test";
import {
  applyHttpAuth,
  handleHabitatCorsPreflight,
  isHabitatRpcPath,
  legacyRpcHttpRedirect,
  trySapWebSocketUpgrade,
} from "./http-dispatch.ts";
import { createServiceAuthVerifier } from "./service-auth.ts";

describe("http-dispatch", () => {
  test("isHabitatRpcPath matches REST subpaths", () => {
    expect(isHabitatRpcPath("/rpc/v1")).toBe(true);
    expect(isHabitatRpcPath("/rpc/v1/task/list")).toBe(true);
    expect(isHabitatRpcPath("/rpc/v1/task/create")).toBe(true);
    expect(isHabitatRpcPath("/rpc/v1/health/probe")).toBe(true);
    expect(isHabitatRpcPath("/rpc/v1/tts/synthesize")).toBe(true);
    expect(isHabitatRpcPath("/api/health")).toBe(false);
  });

  test("isHabitatRpcPath still matches legacy /hub/rpc/v1 until 0.9.3", () => {
    expect(isHabitatRpcPath("/hub/rpc/v1")).toBe(true);
    expect(isHabitatRpcPath("/hub/rpc/v1/health/probe")).toBe(true);
  });

  test("legacyRpcHttpRedirect 302 to /rpc/v1", () => {
    const res = legacyRpcHttpRedirect(
      new Request("http://127.0.0.1:2658/hub/rpc/v1/health/probe?x=1"),
    );
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("http://127.0.0.1:2658/rpc/v1/health/probe?x=1");
    expect(
      legacyRpcHttpRedirect(new Request("http://127.0.0.1:2658/rpc/v1/health/probe")),
    ).toBeNull();
  });

  test("applyHttpAuth blocks GET /rpc/v1/task/list without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/rpc/v1/task/list");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked?.status).toBe(401);
  });

  test("applyHttpAuth allows GET /rpc/v1/health/probe without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/rpc/v1/health/probe");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
  });

  test("applyHttpAuth allows GET /rpc/v1/health/probe on public host without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/rpc/v1/health/probe");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
  });

  test("applyHttpAuth blocks without token for protected hub rpc", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/rpc/v1/status/get");
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked?.status).toBe(401);
  });

  test("applyHttpAuth blocks POST /rpc/v1 without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/rpc/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "req", id: "1", method: "status.get", payload: {} }),
    });
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked?.status).toBe(401);
  });

  test("handleHabitatCorsPreflight returns 204 for Capacitor origin", () => {
    const req = new Request("https://hub.example.com/rpc/v1/health/probe", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    const res = handleHabitatCorsPreflight(req);
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://localhost");
  });

  test("applyHttpAuth allows OPTIONS preflight without token", async () => {
    const serviceAuth = createServiceAuthVerifier();
    const req = new Request("https://anima.freetrace.me/rpc/v1/task/list", {
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
    const req = new Request("http://127.0.0.1:2658/rpc/v1/task/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_kind: "user", title: "auth-body-test" }),
    });
    const result = await applyHttpAuth(req, "127.0.0.1", serviceAuth);
    expect(result.blocked).toBeNull();
    expect(await result.req.json()).toEqual({ subject_kind: "user", title: "auth-body-test" });
    expect(result.auth).toEqual({
      token_id: 1,
      subject_id: 53,
      subject_type: "user",
      scopes: ["full"],
    });
    expect(result.req.headers.get("x-anima-remote-address")).toBe("127.0.0.1");
  });

  test("trySapWebSocketUpgrade upgrades /rpc/v1 synchronously", async () => {
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
      const ws = new WebSocket(`ws://127.0.0.1:${port}/rpc/v1`);
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
