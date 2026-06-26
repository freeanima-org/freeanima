import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildShellUi } from "@freeanima/shell-ui/build";

const PKG_DIR = import.meta.dir;
const WWW_DIR = join(PKG_DIR, "www");

function isDebugBuild(): boolean {
  return process.env.MOBILE_DEBUG === "1" || process.argv.includes("--debug");
}

/** shell-bridge 先于主 bundle 在 body 末尾执行；资源用相对路径 */
export function arrangeMobileIndexHtml(html: string): string {
  const mainScriptRe = /<script type="module" crossorigin src="(\.\/[^"]+\.js)"><\/script>\s*/;
  const match = html.match(mainScriptRe);
  const bridgeTag = `<script type="module" src="./shell-bridge.js"></script>`;

  if (!match) {
    return html.replace("</body>", `    ${bridgeTag}\n  </body>`);
  }

  const mainScriptTag = match[0].trimEnd();
  const withoutMain = html.replace(mainScriptRe, "");
  return withoutMain.replace("</body>", `    ${bridgeTag}\n    ${mainScriptTag}\n  </body>`);
}

async function bundleBrowserEntry(
  entry: string,
  outdir: string,
  outfile: string,
  opts: { minify: boolean; sourcemap: boolean; define?: Record<string, string> },
): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    naming: outfile,
    target: "browser",
    format: "esm",
    minify: opts.minify,
    ...(opts.sourcemap ? { sourcemap: "linked" as const } : {}),
    define: opts.define,
    external: [],
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
}

export async function buildAppMobile(): Promise<string> {
  const debug = isDebugBuild();
  const shellDist = await buildShellUi({
    appDir: join(PKG_DIR, "app"),
    minify: !debug,
    sourcemap: debug,
    publicPath: "./",
  });

  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(WWW_DIR, { recursive: true });
  cpSync(shellDist, WWW_DIR, { recursive: true });

  await bundleBrowserEntry(join(PKG_DIR, "src", "shell-bridge.ts"), WWW_DIR, "shell-bridge.js", {
    minify: !debug,
    sourcemap: debug,
    define: {
      __MOBILE_DEBUG__: JSON.stringify(debug),
    },
  });

  const indexPath = join(WWW_DIR, "index.html");
  const html = readFileSync(indexPath, "utf-8");
  writeFileSync(indexPath, arrangeMobileIndexHtml(html));

  return WWW_DIR;
}

if (import.meta.main) {
  void buildAppMobile().then((dir) => {
    console.log(`built app-mobile www -> ${dir}`);
  });
}
