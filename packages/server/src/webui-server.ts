import type { Server as HttpServer } from "node:http";
import { createServer } from "node:http";
import { WEBUI_BASE_PATH } from "@freeanima/legacy-runtime";
import webuiHtml from "../../../apps/webui/index.html";
import { createHttpRoutes, handleNodeHttpRequest } from "./http-routes";

export type WebuiServerOptions = {
  development?: boolean;
};

export type WebuiServerHandle = {
  server: HttpServer;
  bunDev: ReturnType<typeof Bun.serve> | null;
  close: () => void | Promise<void>;
};

export async function startWebuiHttpServer(
  host: string,
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle> {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  if (development) {
    process.env.NODE_ENV = "development";
  }

  const bunDev = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    development,
    routes: {
      [WEBUI_BASE_PATH]: webuiHtml,
      [`${WEBUI_BASE_PATH}/*`]: webuiHtml,
    },
    fetch(_req) {
      return new Response("Not Found", { status: 404 });
    },
  });

  const proxyWebui = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const upstream = `http://127.0.0.1:${bunDev.port}${url.pathname}${url.search}`;
    return fetch(upstream, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    });
  };

  const routes = createHttpRoutes(proxyWebui);
  let closeWs: (() => void) | null = null;

  const server = createServer((req, res) => {
    void handleNodeHttpRequest(routes, req, res);
  });

  closeWs = routes.attachTrpcWs(server, bunDev.port);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  return {
    server,
    bunDev,
    close: () => {
      closeWs?.();
      routes.shutdown();
      server.close();
      bunDev.stop(true);
    },
  };
}

export async function startWebuiHttpServers(
  hosts: string[],
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle[]> {
  if (hosts.length === 1) {
    return [await startWebuiHttpServer(hosts[0]!, port, options)];
  }
  return Promise.all(hosts.map((host) => startWebuiHttpServer(host, port, options)));
}

export async function closeWebuiHttpServers(
  handles: WebuiServerHandle[],
  _timeoutMs = 3000,
): Promise<void> {
  for (const h of handles) {
    await h.close();
  }
}

export { WEBUI_BASE_PATH };
