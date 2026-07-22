import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchHabitatRestRaw, parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";
import {
  companionCacheDir,
  companionConfigPath,
  companionHome,
  companionModelsDir,
  companionMotionsDir,
  ensureCompanionDataDir,
} from "./paths.ts";
import { hubUrlFromConfig, remoteAuthTokenFromShell } from "./config.ts";

type SyncPullResponse = {
  config: Record<string, unknown>;
  asset_urls: string[];
};

type ConfigGetResponse = {
  config: {
    models: unknown[];
    motion_library: unknown[];
  };
};

type MigrateResponse = {
  imported_models: number;
  imported_motions: number;
};

const MIGRATE_MARKER = join(companionHome(), ".hub-migrated");

function hubMigrateMarkerExists(): boolean {
  return existsSync(MIGRATE_MARKER);
}

function markHubMigrated(): void {
  writeFileSync(MIGRATE_MARKER, new Date().toISOString(), "utf-8");
}

function localCompanionHasLegacyData(): boolean {
  const configPath = companionConfigPath();
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf-8")) as {
        models?: unknown[];
        motion_library?: unknown[];
      };
      if ((raw.models?.length ?? 0) > 0 || (raw.motion_library?.length ?? 0) > 0) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return (
    listDataFiles(companionModelsDir(), ".vrm").length > 0 ||
    listDataFiles(companionMotionsDir(), ".vrma").length > 0
  );
}

function listDataFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    if (!name.toLowerCase().endsWith(ext)) return false;
    try {
      return statSync(join(dir, name)).isFile();
    } catch {
      return false;
    }
  });
}

async function hubRpcCall<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = remoteAuthTokenFromShell();
  const options = token !== undefined ? { authToken: token } : undefined;
  const res = await fetchHabitatRestRaw(hubUrlFromConfig(), method, payload, options);
  return (await parseHabitatRestResponse(res)) as T;
}

async function downloadAsset(url: string): Promise<void> {
  const habitatUrl = hubUrlFromConfig();
  const token = remoteAuthTokenFromShell();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const absolute = url.startsWith("http") ? url : `${habitatUrl.replace(/\/$/, "")}${url}`;
  const res = await fetch(absolute, { headers });
  if (!res.ok) throw new Error(`download failed: ${absolute}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const parsed = new URL(absolute);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1];
  if (!fileName) return;
  const kind = parts[parts.length - 2];
  const destDir =
    kind === "models"
      ? companionModelsDir()
      : kind === "motions"
        ? companionMotionsDir()
        : companionCacheDir();
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, decodeURIComponent(fileName)), bytes);
}

async function uploadLocalFile(
  method: "companion.model.upload" | "companion.motion.import",
  filePath: string,
): Promise<boolean> {
  const habitatUrl = hubUrlFromConfig().replace(/\/$/, "");
  const token = remoteAuthTokenFromShell();
  const bytes = readFileSync(filePath);
  const name = filePath.split(/[/\\]/).pop() ?? "upload.bin";
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  try {
    await fetchHabitatRestRaw(
      habitatUrl,
      method,
      {},
      {
        ...(token !== undefined ? { authToken: token } : {}),
        body: form,
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function pushLocalAssetsToHub(): Promise<void> {
  for (const file of listDataFiles(companionModelsDir(), ".vrm")) {
    try {
      await uploadLocalFile("companion.model.upload", join(companionModelsDir(), file));
    } catch (e) {
      console.warn("[companion] model upload skipped:", file, e);
    }
  }
  for (const file of listDataFiles(companionMotionsDir(), ".vrma")) {
    try {
      await uploadLocalFile("companion.motion.import", join(companionMotionsDir(), file));
    } catch (e) {
      console.warn("[companion] motion upload skipped:", file, e);
    }
  }
}

/** Habitat profile 为空时，将本机 ~/.anima/companion/ 一次性导入 Habitat */
async function maybeMigrateLocalCompanionToHub(): Promise<void> {
  if (hubMigrateMarkerExists() || !localCompanionHasLegacyData()) return;

  try {
    const { config } = await hubRpcCall<ConfigGetResponse>("companion.config.get", {});
    const hubEmpty = config.models.length === 0 && config.motion_library.length === 0;
    if (!hubEmpty) {
      markHubMigrated();
      return;
    }

    const migrate = await hubRpcCall<MigrateResponse>("companion.migrate.fromLocal", {
      source_dir: companionHome(),
    });
    if (migrate.imported_models + migrate.imported_motions === 0) {
      await pushLocalAssetsToHub();
    }
    markHubMigrated();
    console.log("[companion] migrated local companion data to Habitat");
  } catch (e) {
    console.warn("[companion] local→Habitat migrate skipped:", e);
  }
}

/** 从 Habitat 拉取 companion 配置与缺失资产，写入本地 cache */
export async function syncCompanionFromHub(): Promise<boolean> {
  await maybeMigrateLocalCompanionToHub();
  try {
    const result = await hubRpcCall<SyncPullResponse>("companion.sync.pull", {});
    ensureCompanionDataDir();
    const {
      habitat_url: _habitat,
      hub_url: _hub,
      model_path: _mp,
      model_available: _ma,
      fbx_import_available: _fbx,
      ...persist
    } = result.config;
    writeFileSync(companionConfigPath(), JSON.stringify(persist, null, 2), "utf-8");
    for (const url of result.asset_urls) {
      try {
        await downloadAsset(url);
      } catch (e) {
        console.warn("[companion] asset download skipped:", url, e);
      }
    }
    return true;
  } catch (e) {
    console.warn("[companion] Habitat sync failed, using local cache:", e);
    return false;
  }
}
