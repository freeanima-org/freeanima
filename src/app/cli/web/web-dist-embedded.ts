import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export type EmbeddedWebDistFile = {
  /** 相对 web dist 根的路径，如 `index.html` / `assets/foo.js` */
  rel: string;
  /** `with { type: "file" }` 解析后的路径 */
  path: string;
};

const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_WEB_DIST__";

type EmbeddedWebDistGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: EmbeddedWebDistFile[];
};

/** 由 standalone-embed-boot（编译期 type:file 嵌入）注入 */
export function registerEmbeddedWebDist(files: EmbeddedWebDistFile[]): void {
  (globalThis as EmbeddedWebDistGlobal)[GLOBAL_KEY] = files;
}

export function getRegisteredEmbeddedWebDist(): EmbeddedWebDistFile[] | null {
  const files = (globalThis as EmbeddedWebDistGlobal)[GLOBAL_KEY];
  return files && files.length > 0 ? files : null;
}

/** 将嵌入的 Web 静态文件落到磁盘目录供 Habitat /web 托管 */
export function materializeEmbeddedWebDist(files: EmbeddedWebDistFile[]): string {
  const hash = createHash("sha256")
    .update(
      files
        .map((f) => f.rel)
        .toSorted()
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
  const dir = join(tmpdir(), `freeanima-web-dist-${hash}`);
  const marker = join(dir, ".ok");
  if (existsSync(marker)) return dir;

  for (const file of files) {
    const dest = join(dir, file.rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(file.path));
  }
  writeFileSync(marker, "1");
  return dir;
}
