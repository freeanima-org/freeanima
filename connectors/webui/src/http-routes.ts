import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { createProxyServer, type ServerOptions } from "http-proxy";
import { WebSocketServer } from "ws";
import { WEBUI_BASE_PATH } from "@freeanima/legacy-runtime";
import { getHealth } from "./handlers/index.ts";
import { createTrpcContext } from "./trpc/context.ts";
import { appRouter } from "./trpc/router.ts";
import { closeAllTerminalSessions } from "./trpc/terminal-session.ts";

export const TRPC_HTTP_PATH = "/api/trpc";
export const TRPC_WS_PATH = "/api/trpc/ws";
export const HEALTH_PATH = "/api/health";

const WEBUI_CHAT_PATH = `${WEBUI_BASE_PATH}/parlor/chat`;

/** Bun fullstack dev 产物（CSS/JS）挂在站点根，不在 /webui 下 */
const BUN_DEV_ASSET_PREFIX = "/_bun/";

function isWebuiOrBunDevAsset(pathname: string): boolean {
  return pathname.startsWith(WEBUI_BASE_PATH) || pathname.startsWith(BUN_DEV_ASSET_PREFIX);
}

export type HttpRoutesHandle = {
  fetch: (req: Request) => Response | Promise<Response | undefined>;
  attachTrpcWs: (httpServer: HttpServer, bunDevPort?: number) => () => void;
  shutdown: () => void;
};

function createBunDevProxy(bunDevPort: number) {
  const proxy = createProxyServer({ target: `http://127.0.0.1:${bunDevPort}`, ws: true });
  proxy.on("error", (err, _req, res) => {
    console.error("[webui] bun dev proxy error:", err);
    if (res && "writeHead" in res && !res.headersSent) {
      (res as ServerResponse).writeHead(502);
      (res as ServerResponse).end("Bad Gateway");
    }
  });
  return {
    ws: (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      proxy.ws(req, socket, head, { target: `http://127.0.0.1:${bunDevPort}` } as ServerOptions);
    },
    close: () => {
      proxy.close();
    },
  };
}

function redirectRoot(origin: string): Response {
  return Response.redirect(`${origin}${WEBUI_CHAT_PATH}`, 302);
}

async function handleTrpcFetch(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: TRPC_HTTP_PATH,
    req,
    router: appRouter,
    createContext: createTrpcContext,
  });
}

async function handleHealth(): Promise<Response> {
  const data = await getHealth();
  return Response.json(data);
}

/** 对外 HTTP：/api/*；/webui/* 由 proxyWebui 处理 */
export function createHttpRoutes(
  proxyWebui: (req: Request) => Response | Promise<Response>,
): HttpRoutesHandle {
  const fetch = async (req: Request): Promise<Response | undefined> => {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "") {
      return redirectRoot(url.origin);
    }

    if (url.pathname === HEALTH_PATH) {
      return handleHealth();
    }

    if (url.pathname.startsWith(TRPC_HTTP_PATH)) {
      return handleTrpcFetch(req);
    }

    if (isWebuiOrBunDevAsset(url.pathname)) {
      return proxyWebui(req);
    }

    return new Response("Not Found", { status: 404 });
  };

  const attachTrpcWs = (httpServer: HttpServer, bunDevPort?: number): (() => void) => {
    const wss = new WebSocketServer({ noServer: true, path: TRPC_WS_PATH });
    const handler = applyWSSHandler({
      wss,
      router: appRouter,
      createContext: createTrpcContext,
      keepAlive: { enabled: true, pingMs: 30_000, pongWaitMs: 5_000 },
    });

    let bunProxy: ReturnType<typeof createBunDevProxy> | null = null;
    if (bunDevPort != null) {
      bunProxy = createBunDevProxy(bunDevPort);
    }

    const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";

      if (pathname.startsWith(BUN_DEV_ASSET_PREFIX) && bunProxy) {
        bunProxy.ws(req, socket, head);
        return;
      }

      if (pathname === TRPC_WS_PATH) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
        return;
      }

      socket.destroy();
    };

    httpServer.on("upgrade", onUpgrade);

    return () => {
      httpServer.off("upgrade", onUpgrade);
      bunProxy?.close();
      handler.broadcastReconnectNotification();
      wss.close();
    };
  };

  const shutdown = () => {
    closeAllTerminalSessions();
  };

  return { fetch, attachTrpcWs, shutdown };
}

async function readNodeBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function nodeRequestToWebRequest(req: IncomingMessage, body?: Buffer): Request {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method,
    headers,
    body: body?.length ? Uint8Array.from(body) : undefined,
  });
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (response.body) {
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } else {
    res.end();
  }
}

export async function handleNodeHttpRequest(
  routes: HttpRoutesHandle,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = await readNodeBody(req);
    const webReq = nodeRequestToWebRequest(req, body);
    const response = await routes.fetch(webReq);
    if (!response) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    await writeWebResponse(res, response);
  } catch (e) {
    console.error("[http-routes] error:", e);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}
