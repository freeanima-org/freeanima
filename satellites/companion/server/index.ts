import { connectSap } from "./sap/run.ts";
import { corsPreflight, jsonResponse } from "./http/cors.ts";
import { saveConfig, hubUrlFromConfig, type CompanionConfig } from "./config.ts";
import { clientCompanionConfig } from "./config-response.ts";
import { reconnectSap } from "./sap/hub.ts";
import { ensureCompanionDataDir } from "./paths.ts";
import {
  addModelFromUpload,
  deleteModel,
  listModels,
  renameModel,
  setActiveModel,
} from "./model-registry.ts";
import {
  boothMotionPackUrl,
  downloadMotionsFromUrl,
  ensureDefaultMotions,
  handleMotionUpload,
  motionsReady,
  publicMotionsDir,
  REQUIRED_MOTION_FILES,
} from "./motions.ts";
import { companionMotionsDir } from "./paths.ts";
import {
  deleteMotion,
  listMotionLibrary,
  renameMotion,
  setSlotMotions,
  syncLibraryFromDisk,
} from "./motion-library.ts";
import { MOTION_SLOT_IDS, type MotionSlotId } from "../shared/companion-schema.ts";
import { fbxImportAvailable } from "./fbx-converter-kit.ts";
import { serveStatic } from "./static.ts";
import { SATELLITE_PORT_ATTEMPTS, SATELLITE_PORT_START } from "../shared/constants.ts";
import { advanceBubble, runtimeState, bubbleState } from "./runtime-state.ts";
import {
  handleRuntimeWsClose,
  handleRuntimeWsOpen,
  runtimeWsPayload,
  type RuntimeWsClientData,
} from "./runtime-ws.ts";
import type { LocomotionSlot } from "../shared/constants.ts";
import { handleLocomotionImport } from "./locomotion.ts";

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

export async function route(
  req: Request,
  server: Bun.Server<RuntimeWsClientData>,
): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/api/runtime/ws") {
    if (server.upgrade(req, { data: { channel: "runtime" } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse(clientCompanionConfig());
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    return jsonResponse(clientCompanionConfig());
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = (await req.json()) as Partial<CompanionConfig>;
    const prev = hubUrlFromConfig();
    const next = saveConfig(body);
    if (body.hub_url?.trim() && body.hub_url.trim() !== prev) {
      reconnectSap(next.hub_url.replace(/\/$/, ""), HTTP_URL);
    }
    return jsonResponse(clientCompanionConfig(next));
  }

  if (url.pathname === "/api/runtime" && req.method === "GET") {
    return jsonResponse({ ...runtimeState(), play: [] });
  }

  if (url.pathname === "/api/bubbles/advance" && req.method === "POST") {
    return jsonResponse({ current: advanceBubble() });
  }

  if (url.pathname === "/api/models" && req.method === "GET") {
    return jsonResponse({ models: listModels() });
  }

  if (url.pathname === "/api/models/upload" && req.method === "POST") {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonResponse({ error: "无效的 multipart 请求" }, 400);
    }
    const entry = form.get("file");
    if (!(entry instanceof File)) {
      return jsonResponse({ error: "缺少 file 字段" }, 400);
    }
    try {
      const model = await addModelFromUpload(entry);
      return jsonResponse({ model, config: clientCompanionConfig() });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/models/active" && req.method === "POST") {
    const body = (await req.json()) as { id?: string };
    if (!body.id) return jsonResponse({ error: "需要 id" }, 400);
    try {
      const model = setActiveModel(body.id);
      return jsonResponse({ model, config: clientCompanionConfig() });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/models/rename" && req.method === "POST") {
    const body = (await req.json()) as { id?: string; name?: string };
    if (!body.id || !body.name) return jsonResponse({ error: "需要 id 与 name" }, 400);
    try {
      return jsonResponse({ model: renameModel(body.id, body.name) });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/models/delete" && req.method === "POST") {
    const body = (await req.json()) as { id?: string };
    if (!body.id) return jsonResponse({ error: "需要 id" }, 400);
    try {
      deleteModel(body.id);
      return jsonResponse({ config: clientCompanionConfig() });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/motions/library" && req.method === "GET") {
    syncLibraryFromDisk();
    return jsonResponse({
      library: listMotionLibrary(),
      slots: clientCompanionConfig().motion_slots,
    });
  }

  if (url.pathname === "/api/motions/library/rename" && req.method === "POST") {
    const body = (await req.json()) as { id?: string; name?: string };
    if (!body.id || !body.name) return jsonResponse({ error: "需要 id 与 name" }, 400);
    try {
      return jsonResponse({ entry: renameMotion(body.id, body.name) });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/motions/library/delete" && req.method === "POST") {
    const body = (await req.json()) as { id?: string };
    if (!body.id) return jsonResponse({ error: "需要 id" }, 400);
    try {
      deleteMotion(body.id);
      return jsonResponse({ library: listMotionLibrary(), config: clientCompanionConfig() });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/motions/slots" && req.method === "POST") {
    const body = (await req.json()) as { slot?: string; motion_ids?: string[] };
    if (!body.slot || !MOTION_SLOT_IDS.includes(body.slot as MotionSlotId)) {
      return jsonResponse({ error: "无效 slot" }, 400);
    }
    try {
      setSlotMotions(body.slot as MotionSlotId, body.motion_ids ?? []);
      return jsonResponse({ config: clientCompanionConfig() });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (url.pathname === "/api/motions/status" && req.method === "GET") {
    const userDir = companionMotionsDir();
    return jsonResponse({
      ready: motionsReady(userDir) || motionsReady(publicMotionsDir()),
      user_dir: userDir,
      required: [...REQUIRED_MOTION_FILES],
      booth_url: boothMotionPackUrl(),
      auto_download_configured: Boolean(process.env.COMPANION_VRMA_ZIP_URL?.trim()),
      fbx_import_available: fbxImportAvailable(),
    });
  }

  if (url.pathname === "/api/motions/import" && req.method === "POST") {
    const res = await handleMotionUpload(req);
    syncLibraryFromDisk();
    return res;
  }

  if (url.pathname === "/api/motions/locomotion" && req.method === "GET") {
    const cfg = clientCompanionConfig();
    return jsonResponse({
      library: cfg.motion_library,
      slots: cfg.motion_slots,
      user_dir: companionMotionsDir(),
    });
  }

  const locomotionImportMatch = url.pathname.match(
    /^\/api\/motions\/locomotion\/(walk|climb)\/import$/,
  );
  if (locomotionImportMatch) {
    const res = await handleLocomotionImport(req, locomotionImportMatch[1] as LocomotionSlot);
    syncLibraryFromDisk();
    return res;
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
      syncLibraryFromDisk();
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
let server: ReturnType<typeof Bun.serve<RuntimeWsClientData>>;

try {
  server = startServer();
  void ensureDefaultMotions().then(() => syncLibraryFromDisk());
  void connectSap(hubUrlFromConfig(), HTTP_URL);
} catch (error) {
  console.error(
    "companion-sidecar-fatal:",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
}

function startServer(): ReturnType<typeof Bun.serve<RuntimeWsClientData>> {
  ensureCompanionDataDir();

  for (let i = 0; i < PORT_ATTEMPTS; i++) {
    const port = PORT_START + i;
    try {
      const instance = Bun.serve<RuntimeWsClientData>({
        port,
        fetch(req, srv) {
          return route(req, srv);
        },
        websocket: {
          open(ws) {
            handleRuntimeWsOpen(ws);
            ws.send(JSON.stringify(runtimeWsPayload(bubbleState(), [])));
          },
          close(ws) {
            handleRuntimeWsClose(ws);
          },
          message() {},
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
