import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildShellUi } from "@freeanima/shell-ui/build";

const PKG_DIR = import.meta.dir;
const DIST_DIR = join(PKG_DIR, "dist");

export type BuildAppWebOptions = {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
  defaultHubUrl?: string;
  defaultRemoteAuthToken?: string;
};

/** shell-bridge 先于主 bundle 在 body 末尾执行 */
function arrangeShellBridgeHtml(html: string): string {
  const mainScriptRe = /<script type="module" crossorigin src="(\.\/[^"]+\.js)"><\/script>/;
  const match = html.match(mainScriptRe);
  if (!match) {
    return html.replace(
      "</head>",
      `    <script type="module" src="./shell-bridge.js"></script>\n  </head>`,
    );
  }
  const mainScriptTag = match[0];
  const withoutMain = html.replace(mainScriptRe, "");
  return withoutMain.replace(
    '<div id="root"></div>',
    `<div id="root"></div>\n    <script type="module" src="./shell-bridge.js"></script>\n    ${mainScriptTag}`,
  );
}

async function bundleShellBridge(
  outdir: string,
  opts: { minify: boolean; sourcemap: boolean; defaultHubUrl: string; defaultRemoteAuthToken: string },
): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(PKG_DIR, "src", "shell-bridge.ts")],
    outdir,
    naming: "shell-bridge.js",
    target: "browser",
    format: "esm",
    minify: opts.minify,
    ...(opts.sourcemap ? { sourcemap: "linked" as const } : {}),
    define: {
      __WEB_DEFAULT_HUB_URL__: JSON.stringify(opts.defaultHubUrl),
      __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: JSON.stringify(opts.defaultRemoteAuthToken),
    },
    external: [],
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
}

export async function buildAppWeb(opts?: BuildAppWebOptions): Promise<string> {
  const minify = opts?.minify ?? false;
  const sourcemap = opts?.sourcemap ?? true;
  const defaultHubUrl = (opts?.defaultHubUrl ?? process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(
    /\/$/,
    "",
  );
  const defaultRemoteAuthToken = opts?.defaultRemoteAuthToken ?? process.env.FREEANIMA_REMOTE_AUTH_TOKEN ?? "";

  await buildShellUi({
    appDir: join(PKG_DIR, "app"),
    outdir: DIST_DIR,
    watch: opts?.watch,
    minify,
    sourcemap,
    publicPath: "./",
  });

  await bundleShellBridge(DIST_DIR, {
    minify,
    sourcemap,
    defaultHubUrl,
    defaultRemoteAuthToken,
  });

  const indexPath = join(DIST_DIR, "index.html");
  const html = readFileSync(indexPath, "utf-8");
  writeFileSync(indexPath, arrangeShellBridgeHtml(html));

  return DIST_DIR;
}

if (import.meta.main) {
  void buildAppWeb({ minify: true, sourcemap: false }).then((dir) => {
    console.log(`built app-web -> ${dir}`);
  });
}
