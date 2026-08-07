/**
 * 按 FREEANIMA_BUILD_CHANNEL（缺省 local）写出 Tauri `--config` 合并层。
 * 基线 `tauri.conf.json` 保持正式身份；local 覆盖为 `.portal.dev`（路径兼容）。
 * 版本 / Android versionCode 来自 FREEANIMA_BUILD_VERSION（canary/local 含 stamp），
 * 避免 APK versionName 卡在基线 release 号导致「关于」与更新检测误判同版。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeAndroidVersionCode } from "@freeanima/host/core/config/android-version-code.ts";
import { resolveBuildChannelFromEnv } from "@freeanima/host/core/config/build-meta.ts";
import type { BuildChannel } from "@freeanima/host/core/config/build-meta.parse.ts";
import { resolveBuildVersionFromEnv } from "@freeanima/host/core/config/resolve-build-version.ts";
import {
  resolveDesktopShellIdentity,
  resolveMobileShellIdentity,
  type DesktopShellIdentity,
  type MobileShellIdentity,
} from "@freeanima/host/core/config/shell-identity.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcTauriDefault = join(root, "src/portal/app/tauri/src-tauri");

export const TAURI_IDENTITY_OVERLAY_NAME = "tauri.conf.identity.generated.json";

export type TauriShellTarget = "desktop" | "mobile";

export type AppliedTauriShellIdentity = {
  channel: BuildChannel;
  target: TauriShellTarget;
  configPath: string;
  /** 传给 `tauri build|dev --config` */
  configArg: string;
  version: string;
  desktop?: DesktopShellIdentity;
  mobile?: MobileShellIdentity;
  /** 仅 mobile：写入 bundle.android.versionCode */
  androidVersionCode?: number;
};

type TauriConfWindow = {
  label?: string;
  title?: string;
  [key: string]: unknown;
};

type TauriConfShape = {
  productName?: string;
  identifier?: string;
  mainBinaryName?: string;
  version?: string;
  app?: {
    windows?: TauriConfWindow[];
    [key: string]: unknown;
  };
  bundle?: {
    android?: {
      versionCode?: number;
      minSdkVersion?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function applyTauriShellIdentity(options?: {
  target?: TauriShellTarget;
  srcTauri?: string;
  env?: NodeJS.ProcessEnv;
  repoRoot?: string;
}): AppliedTauriShellIdentity {
  const env = options?.env ?? process.env;
  const target = options?.target ?? "desktop";
  const srcTauri = options?.srcTauri ?? srcTauriDefault;
  const repoRoot = options?.repoRoot ?? root;
  const channel = resolveBuildChannelFromEnv("local", env);
  const version = resolveBuildVersionFromEnv(repoRoot, env, { channel });

  const basePath = join(srcTauri, "tauri.conf.json");
  const base = JSON.parse(readFileSync(basePath, "utf-8")) as TauriConfShape;

  const overlay: TauriConfShape = { version };

  if (target === "desktop") {
    const id = resolveDesktopShellIdentity(channel);
    overlay.productName = id.productName;
    overlay.identifier = id.appId;
    overlay.mainBinaryName = id.executableName;
    const windows = (base.app?.windows ?? []).map((w) => ({ ...w }));
    if (windows.length === 0) {
      windows.push({ label: "main", title: id.productName });
    } else {
      const main = windows.find((w) => w.label === "main") ?? windows[0];
      if (main) main.title = id.productName;
    }
    overlay.app = { windows };
    const configPath = writeOverlay(srcTauri, overlay);
    console.log(
      `[tauri-identity] channel=${channel} version=${version} desktop ${id.appId} / ${id.productName} → ${configPath}`,
    );
    return { channel, target, configPath, configArg: configPath, version, desktop: id };
  }

  const id = resolveMobileShellIdentity(channel);
  overlay.productName = id.appName;
  overlay.identifier = id.applicationId;
  const androidVersionCode = computeAndroidVersionCode(version, { channel });
  overlay.bundle = {
    android: {
      versionCode: androidVersionCode,
    },
  };
  const configPath = writeOverlay(srcTauri, overlay);
  console.log(
    `[tauri-identity] channel=${channel} version=${version} versionCode=${androidVersionCode} mobile ${id.applicationId} / ${id.appName} → ${configPath}`,
  );
  return {
    channel,
    target,
    configPath,
    configArg: configPath,
    version,
    mobile: id,
    androidVersionCode,
  };
}

function writeOverlay(srcTauri: string, overlay: TauriConfShape): string {
  mkdirSync(srcTauri, { recursive: true });
  const configPath = join(srcTauri, TAURI_IDENTITY_OVERLAY_NAME);
  writeFileSync(configPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf-8");
  return configPath;
}

/** CLI：`bun scripts/apply-tauri-shell-identity.ts [desktop|mobile]` */
if (import.meta.main) {
  const arg = process.argv[2];
  const target: TauriShellTarget = arg === "mobile" ? "mobile" : "desktop";
  applyTauriShellIdentity({ target });
}
