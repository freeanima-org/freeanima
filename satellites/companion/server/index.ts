import { connectSap } from "./sap/run.ts";
import { getSapInstanceId } from "./sap/hub.ts";
import { corsPreflight, jsonResponse } from "./http/cors.ts";
import { loadConfig, saveConfig, hubUrlFromConfig, type CompanionConfig } from "./config.ts";
import { isModelPathAvailable } from "./model-path.ts";
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

const PORT = Number(process.env.SATELLITE_PORT ?? 4176);
const HTTP_URL = `http://127.0.0.1:${PORT}`;

ensureCompanionDataDir();

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    const cfg = loadConfig();
    return jsonResponse({
      app_id: "companion",
      instance_id: getSapInstanceId(),
      hub_url: cfg.hub_url,
      model_path: cfg.model_path,
      model_available: isModelPathAvailable(cfg.model_path),
    });
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    const cfg = loadConfig();
    return jsonResponse({
      ...cfg,
      model_available: isModelPathAvailable(cfg.model_path),
    });
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = (await req.json()) as Partial<CompanionConfig>;
    const next = saveConfig(body);
    return jsonResponse({
      ...next,
      model_available: isModelPathAvailable(next.model_path),
    });
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

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    return route(req);
  },
});

console.log(`companion satellite ${HTTP_URL}`);

void ensureDefaultMotions();
void connectSap(hubUrlFromConfig(), HTTP_URL);

export { server, HTTP_URL, serveStatic };
