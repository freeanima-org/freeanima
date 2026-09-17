import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { WebSocketServer } from "ws";

type ConnectNext = () => void;
export type DevMiddleware = (req: IncomingMessage, res: ServerResponse, next: ConnectNext) => void;

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function incomingMessageToRequest(
  req: IncomingMessage,
  baseUrl: string,
): Promise<Request> {
  const url = new URL(req.url ?? "/", baseUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const body = await readRequestBody(req);
  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    ...(body !== undefined ? { body: new Uint8Array(body) } : {}),
  });
}

export async function writeFetchResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

export type NodeHttpServerOptions = {
  port: number;
  host?: string;
  baseUrl: string;
  handler: (req: Request) => Promise<Response>;
  wss: WebSocketServer;
  wsPath?: string;
  /** Vite middlewareMode（开发 HMR） */
  devMiddleware?: DevMiddleware;
};

export function createNodeHttpServer(opts: NodeHttpServerOptions): Server {
  const wsPath = opts.wsPath ?? "/api/runtime/ws";
  const server = createServer((req, res) => {
    const runHandler = (): void => {
      void (async () => {
        try {
          const request = await incomingMessageToRequest(req, opts.baseUrl);
          const response = await opts.handler(request);
          await writeFetchResponse(res, response);
        } catch (error) {
          console.error("companion-http-error:", error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error" }));
          }
        }
      })();
    };

    if (opts.devMiddleware) {
      opts.devMiddleware(req, res, runHandler);
      return;
    }
    runHandler();
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? new URL(req.url, opts.baseUrl).pathname : "";
    if (pathname !== wsPath) {
      socket.destroy();
      return;
    }
    opts.wss.handleUpgrade(req, socket, head, (ws) => {
      opts.wss.emit("connection", ws, req);
    });
  });

  return server;
}

export function listenServer(server: Server, port: number, host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve(address.port);
        return;
      }
      resolve(port);
    });
  });
}
