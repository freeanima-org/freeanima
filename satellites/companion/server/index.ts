import { connectSap } from "./sap/run.ts";
import { corsPreflight, jsonResponse } from "./http/cors.ts";
import { saveConfig, hubUrlFromConfig, type CompanionConfig } from "./config.ts";
import { clientCompanionConfig } from "./config-response.ts";
import { ensureCompanionDataDir } from "./paths.ts";
import { handleModelUpload } from "./models.ts";
import {
  boothMotionPackUrl,
  downloadMotionsFromUrl,
  ensureDefaultMotions,
  handleMotionZipUpload,
  motionsReady,
  publicMotionsDir,
  REQUIRED_MOTION_FILES,
} from "./motions.ts";
import { companionMotionsDir } from "./paths.ts";
import {
  clearLocomotionSlot,
  handleLocomotionImport,
  locomotionConfigForClient,
  locomotionSlotStatus,
} from "./locomotion.ts";
import { LOCOMOTION_SLOTS, type LocomotionSlot } from "./config.ts";
import { serveStatic } from "./static.ts";
import { SATELLITE_PORT_ATTEMPTS, SATELLITE_PORT_START } from "../shared/constants.ts";

const PORT_START = Number(process.env.SATELLITE_PORT ?? SATELLITE_PORT_START);
const PORT_ATTEMPTS = SATELLITE_PORT_ATTEMPTS;

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EADDRINUSE"
  );
}

function announceSidecarPort(port: number): void {
  process.stderr.write(`companion-sidecar-port:${port}\n`);
  console.log(`companion satellite http://127.0.0.1:${port}`);
}

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse(clientCompanionConfig());
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    return jsonResponse(clientCompanionConfig());
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = (await req.json()) as Partial<CompanionConfig>;
    const next = saveConfig(body);
    return jsonResponse(clientCompanionConfig(next));
  }

  if (url.pathname === "/api/models/upload") {
    return handleModelUpload(req);
  }

  if (url.pathname === "/api/motions/status" && req.method === "GET") {
    const userDir = companionMotionsDir();
    return jsonResponse({
      ready: motionsReady(userDir) || motionsReady(publicMotionsDir()),
      user_dir: userDir,
      required: [...REQUIRED_MOTION_FILES],
      booth_url: boothMotionPackUrl(),
      auto_download_configured: Boolean(process.env.COMPANION_VRMA_ZIP_URL?.trim()),
    });
  }

  if (url.pathname === "/api/motions/import" && req.method === "POST") {
    return handleMotionZipUpload(req);
  }

  if (url.pathname === "/api/motions/locomotion" && req.method === "GET") {
    return jsonResponse({
      slots: locomotionSlotStatus(),
      configured: locomotionConfigForClient(),
      user_dir: companionMotionsDir(),
    });
  }

  const locomotionImportMatch = url.pathname.match(
    /^\/api\/motions\/locomotion\/(walk|climb)\/import$/,
  );
  if (locomotionImportMatch) {
    return handleLocomotionImport(req, locomotionImportMatch[1] as LocomotionSlot);
  }

  if (url.pathname === "/api/motions/locomotion/clear" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { slot?: string };
    const slot = body.slot as LocomotionSlot | undefined;
    if (!slot || !LOCOMOTION_SLOTS.includes(slot)) {
      return jsonResponse({ error: "需要 slot: walk | climb" }, 400);
    }
    await clearLocomotionSlot(slot);
    return jsonResponse({ ok: true, slots: locomotionSlotStatus() });
  }

  if (url.pathname === "/api/motions/download" && req.method === "POST") {
    const urlOverride =
      process.env.COMPANION_VRMA_ZIP_URL?.trim() ||
      ((await req.json().catch(() => ({}))) as { url?: string }).url?.trim();
    if (!urlOverride) {
      return jsonResponse(
        {
          error:
            "未配置 COMPANION_VRMA_ZIP_URL。VRoid 官方包需在 BOOTH 登录后下载，请在设置中导入 ZIP 或打开 BOOTH 页面。",
          booth_url: boothMotionPackUrl(),
        },
        400,
      );
    }
    try {
      const result = await downloadMotionsFromUrl(urlOverride);
      return jsonResponse({ ok: true, ...result });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: "companion" });
  }

  return serveStatic(url.pathname);
}

let HTTP_URL = "";
let server: ReturnType<typeof Bun.serve>;

try {
  server = startServer();
  void ensureDefaultMotions();
  void connectSap(hubUrlFromConfig(), HTTP_URL);
} catch (error) {
  console.error(
    "companion-sidecar-fatal:",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
}

function startServer(): ReturnType<typeof Bun.serve> {
  ensureCompanionDataDir();

  for (let i = 0; i < PORT_ATTEMPTS; i++) {
    const port = PORT_START + i;
    try {
      const instance = Bun.serve({
        port,
        fetch(req) {
          return route(req);
        },
      });
      HTTP_URL = `http://127.0.0.1:${port}`;
      announceSidecarPort(port);
      return instance;
    } catch (error) {
      if (isAddrInUse(error) && i < PORT_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`无法在 ${PORT_START}–${PORT_START + PORT_ATTEMPTS - 1} 找到可用端口`);
}

export { server, HTTP_URL, serveStatic };
