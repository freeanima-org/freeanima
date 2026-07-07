import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

import { SHELL_BRIDGE_ASSET_PREFIX } from "./entry-file-names.ts";

const SHELL_BRIDGE_SCRIPT_RE =
  /<script type="module" crossorigin src="[^"]*\/assets\/shell-bridge-[^"]+\.js"><\/script>\s*/;
const MAIN_SCRIPT_RE =
  /<script type="module" crossorigin src="([^"]*\/assets\/[^"]+\.js)"><\/script>/;

type WriteBundleChunk = {
  type: "chunk";
  name?: string;
  fileName: string;
};

function shellBridgeHrefFromBase(base: string, assetPath: string): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${assetPath}`;
}

function resolveShellBridgeScriptHrefFromBundle(
  bundle: Record<string, unknown>,
  base: string,
): string | null {
  for (const item of Object.values(bundle)) {
    if (item == null || typeof item !== "object") continue;
    const chunk = item as Partial<WriteBundleChunk>;
    if (chunk.type !== "chunk" || chunk.name !== "shell-bridge" || !chunk.fileName) continue;
    return shellBridgeHrefFromBase(base, chunk.fileName);
  }
  return null;
}

function resolveShellBridgeScriptHrefFromDisk(outdir: string, base: string): string | null {
  const assetsDir = join(outdir, "assets");
  if (!existsSync(assetsDir)) return null;
  const file = readdirSync(assetsDir).find(
    (name) => name.startsWith(SHELL_BRIDGE_ASSET_PREFIX) && name.endsWith(".js"),
  );
  if (!file) return null;
  return shellBridgeHrefFromBase(base, `assets/${file}`);
}

/** 确保 index.html 在 main 之前加载 hashed shell-bridge */
export function arrangeShellBridgeIndexHtml(html: string, bridgeHref: string): string {
  const bridgeTag = `<script type="module" crossorigin src="${bridgeHref}"></script>`;
  const withoutBridge = html.replace(SHELL_BRIDGE_SCRIPT_RE, "");
  if (withoutBridge.includes(bridgeHref)) return withoutBridge;

  const mainMatch = withoutBridge.match(MAIN_SCRIPT_RE);
  if (mainMatch) {
    return withoutBridge.replace(mainMatch[0], `${bridgeTag}\n    ${mainMatch[0]}`);
  }

  return withoutBridge.replace("</body>", `    ${bridgeTag}\n  </body>`);
}

function patchShellBridgeIndexHtml(outdir: string, bridgeHref: string): void {
  const indexPath = join(outdir, "index.html");
  const html = readFileSync(indexPath, "utf-8");
  writeFileSync(indexPath, arrangeShellBridgeIndexHtml(html, bridgeHref));
}

export function shellBridgeHtmlPlugin(outdir: string, base = "/web/"): Plugin {
  return {
    name: "shell-bridge-html",
    // Vite 8 / Rolldown 在 closeBundle 时 assets 可能尚未落盘，改在 writeBundle 用 bundle 元数据。
    writeBundle(_options, bundle) {
      const bridgeHref =
        resolveShellBridgeScriptHrefFromBundle(bundle, base) ??
        resolveShellBridgeScriptHrefFromDisk(outdir, base);
      if (!bridgeHref) {
        throw new Error("shell-bridge-html: 构建未产出 assets/shell-bridge-*.js");
      }
      patchShellBridgeIndexHtml(outdir, bridgeHref);
    },
  };
}
