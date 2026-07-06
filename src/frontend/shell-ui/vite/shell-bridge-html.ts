import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

import { SHELL_BRIDGE_ASSET_PREFIX } from "./entry-file-names.ts";

const SHELL_BRIDGE_SCRIPT_RE =
  /<script type="module" crossorigin src="[^"]*\/assets\/shell-bridge-[^"]+\.js"><\/script>\s*/;
const MAIN_SCRIPT_RE =
  /<script type="module" crossorigin src="([^"]*\/assets\/[^"]+\.js)"><\/script>/;

function resolveShellBridgeScriptHref(outdir: string, base: string): string | null {
  const assetsDir = join(outdir, "assets");
  const file = readdirSync(assetsDir).find(
    (name) => name.startsWith(SHELL_BRIDGE_ASSET_PREFIX) && name.endsWith(".js"),
  );
  if (!file) return null;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}assets/${file}`;
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

export function shellBridgeHtmlPlugin(outdir: string, base = "/web/"): Plugin {
  return {
    name: "shell-bridge-html",
    closeBundle() {
      const bridgeHref = resolveShellBridgeScriptHref(outdir, base);
      if (!bridgeHref) {
        throw new Error("shell-bridge-html: 构建未产出 assets/shell-bridge-*.js");
      }
      const indexPath = join(outdir, "index.html");
      const html = readFileSync(indexPath, "utf-8");
      writeFileSync(indexPath, arrangeShellBridgeIndexHtml(html, bridgeHref));
    },
  };
}
