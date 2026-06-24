import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildShellUi } from "@freeanima/shell-ui/build";

const PKG_DIR = import.meta.dir;
const WWW_DIR = join(PKG_DIR, "www");

async function bundleBrowserEntry(entry: string, outdir: string, outfile: string): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    naming: outfile,
    target: "browser",
    format: "esm",
    minify: true,
    external: [],
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
}

export async function buildAppMobile(): Promise<string> {
  const shellDist = await buildShellUi({ minify: true });

  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(WWW_DIR, { recursive: true });
  cpSync(shellDist, WWW_DIR, { recursive: true });

  await bundleBrowserEntry(join(PKG_DIR, "src", "shell-bridge.ts"), WWW_DIR, "shell-bridge.js");

  const indexPath = join(WWW_DIR, "index.html");
  const html = readFileSync(indexPath, "utf-8").replace(
    "</head>",
    `    <script type="module" src="./shell-bridge.js"></script>\n  </head>`,
  );
  writeFileSync(indexPath, html);

  return WWW_DIR;
}

if (import.meta.main) {
  void buildAppMobile().then((dir) => {
    console.log(`built app-mobile www -> ${dir}`);
  });
}
