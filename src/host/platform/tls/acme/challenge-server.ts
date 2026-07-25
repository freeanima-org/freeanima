import { logComponent } from "@freeanima/host/platform/logging";

import { getHttp01Challenge } from "./challenge-store.ts";

export type AcmeChallengeServer = {
  port: number;
  close: () => Promise<void>;
};

const WELL_KNOWN_PREFIX = "/.well-known/acme-challenge/";

function challengeFetch(req: Request): Response {
  const url = new URL(req.url);
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!url.pathname.startsWith(WELL_KNOWN_PREFIX)) {
    return new Response("Not Found", { status: 404 });
  }
  const token = decodeURIComponent(url.pathname.slice(WELL_KNOWN_PREFIX.length));
  if (!token || token.includes("/") || token.includes("..")) {
    return new Response("Not Found", { status: 404 });
  }
  const body = getHttp01Challenge(token);
  if (body === undefined) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(req.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * 独立监听 HTTP-01（默认 :80）。仅服务 `/.well-known/acme-challenge/*`。
 */
export function startAcmeChallengeServer(options: {
  port: number;
  hostname?: string;
}): AcmeChallengeServer {
  const hostname = options.hostname ?? "0.0.0.0";
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({
      hostname,
      port: options.port,
      development: false,
      fetch: challengeFetch,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `ACME HTTP-01 challenge 无法绑定 ${hostname}:${options.port}（常见原因：无 root/CAP_NET_BIND_SERVICE、端口被占）：${detail}`,
      { cause: err },
    );
  }

  if (!server.port) {
    throw new Error(`ACME HTTP-01 challenge 未能绑定 ${hostname}:${options.port}`);
  }

  logComponent("startup").info("ACME HTTP-01 challenge 已监听", {
    host: hostname,
    port: server.port,
  });

  return {
    port: server.port,
    close: async () => {
      await server.stop(true);
    },
  };
}

/** 测试用：不绑定端口，直接处理 Request */
export function handleAcmeChallengeRequest(req: Request): Response {
  return challengeFetch(req);
}
