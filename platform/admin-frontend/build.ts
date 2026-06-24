import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { getRepoRoot, PATHS } from "@freeanima/platform/config";
import { compileParaglideToDir, resolveBundledParaglideDir } from "./paraglide-compile.ts";

const ADMIN_APP_REL = join("platform", "admin-frontend", "app");
const ADMIN_PUBLISH_APP_REL = join("admin-frontend", "app");
const ADMIN_DIST_REL = join("admin-frontend", "dist");
const ADMIN_HTML_NAME = "index.html";
const ADMIN_PUBLIC_PATH = "/admin/";
/** 缓存 manifest 格式版本；构建/layout 变更时递增以作废旧缓存 */
const ADMIN_CACHE_FORMAT = 3;

let cachedProductionDir: string | null = null;
let cachedDevDir: string | null = null;

function walkFiles(dir: string, files: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const ent of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(abs, files);
    } else if (ent.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function hashFileEntry(hash: ReturnType<typeof createHash>, root: string, absPath: string): void {
  const rel = relative(root, absPath);
  const stat = statSync(absPath);
  hash.update(rel);
  hash.update("\0");
  hash.update(String(stat.size));
  hash.update("\0");
  hash.update(String(stat.mtimeMs));
  hash.update("\0");
}

/** 计算 Admin 前端源码 hash（含根 bunfig.toml） */
export function computeAdminSourceHash(appDir: string, repoRoot = getRepoRoot()): string {
  const hash = createHash("sha256");
  const files = walkFiles(appDir).toSorted((a, b) => a.localeCompare(b));
  for (const abs of files) {
    hashFileEntry(hash, appDir, abs);
  }
  const bunfigPath = join(repoRoot, "bunfig.toml");
  if (existsSync(bunfigPath)) {
    hash.update("bunfig.toml");
    hash.update("\0");
    hashFileEntry(hash, repoRoot, bunfigPath);
  }
  return hash.digest("hex");
}

/** Published @freeanima/cli layout, or monorepo `platform/admin-frontend/app`. */
export function resolveAdminAppDir(repoRoot = getRepoRoot()): string {
  const publish = join(repoRoot, ADMIN_PUBLISH_APP_REL);
  if (existsSync(publish)) return publish;
  const monorepo = join(repoRoot, ADMIN_APP_REL);
  if (existsSync(monorepo)) return monorepo;
  return publish;
}

/** Published CLI: admin-frontend/dist（build-cli 预构建） */
export function resolveBundledAdminDistDir(repoRoot = getRepoRoot()): string | null {
  const dir = join(repoRoot, ADMIN_DIST_REL);
  if (isBuiltHtmlValid(join(dir, ADMIN_HTML_NAME))) return dir;
  return null;
}

/** build-cli：在 publish 目录内预构建 Admin 静态资源 */
export async function buildPublishedAdminDist(
  repoRoot: string,
  outdir = join(repoRoot, ADMIN_DIST_REL),
): Promise<string> {
  const appDir = resolveAdminAppDir(repoRoot);
  await buildAdminToDir(appDir, { outdir, minify: true }, repoRoot);
  return outdir;
}

function adminAppDir(): string {
  return resolveAdminAppDir();
}

function cacheDirForHash(hash: string): string {
  return join(PATHS.adminBuildDir, hash);
}

function cacheHtmlPath(hash: string): string {
  return join(cacheDirForHash(hash), ADMIN_HTML_NAME);
}

type AdminBuildManifest = {
  hash: string;
  builtAt: string;
  format: number;
  publicPath: string;
};

function readBuildManifest(): AdminBuildManifest | null {
  const path = join(PATHS.adminBuildDir, "current.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AdminBuildManifest;
  } catch {
    return null;
  }
}

function writeBuildManifest(hash: string): void {
  mkdirSync(PATHS.adminBuildDir, { recursive: true });
  const manifest: AdminBuildManifest = {
    hash,
    builtAt: new Date().toISOString(),
    format: ADMIN_CACHE_FORMAT,
    publicPath: ADMIN_PUBLIC_PATH,
  };
  writeFileSync(join(PATHS.adminBuildDir, "current.json"), JSON.stringify(manifest, null, 2));
}

function isBuiltHtmlValid(htmlPath: string): boolean {
  if (!existsSync(htmlPath)) return false;
  try {
    const html = readFileSync(htmlPath, "utf-8");
    return html.includes(`${ADMIN_PUBLIC_PATH}chunk-`);
  } catch {
    return false;
  }
}

function isProductionCacheValid(hash: string): boolean {
  const htmlPath = cacheHtmlPath(hash);
  if (!isBuiltHtmlValid(htmlPath)) return false;
  const manifest = readBuildManifest();
  if (manifest?.hash !== hash) return false;
  if (manifest.format !== ADMIN_CACHE_FORMAT) return false;
  if (manifest.publicPath !== ADMIN_PUBLIC_PATH) return false;
  return true;
}

function pruneStaleBuildCaches(currentHash: string): void {
  const root = PATHS.adminBuildDir;
  if (!existsSync(root)) return;
  const keep = new Set([currentHash]);
  const prev = readBuildManifest();
  if (prev?.hash && prev.hash !== currentHash) {
    keep.add(prev.hash);
  }
  for (const name of readdirSync(root)) {
    if (name === "current.json") continue;
    if (keep.has(name)) continue;
    try {
      rmSync(join(root, name), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function loadTailwindPlugin(): Promise<import("bun").BunPlugin> {
  const mod = await import("bun-plugin-tailwind");
  return mod.default;
}

type BuildAdminOptions = {
  outdir: string;
  minify: boolean;
  watch?: boolean;
  sourcemap?: boolean;
};

function paraglideBuildDir(): string {
  return join(PATHS.adminBuildDir, "paraglide");
}

/** npm publish 用预编译产物；monorepo 编译到 ~/.anima/runtime/admin-build/paraglide */
function resolveParaglideDir(repoRoot: string): string {
  const bundled = resolveBundledParaglideDir(repoRoot);
  if (bundled) return bundled;
  return compileParaglideToDir({ projectRoot: repoRoot, outdir: paraglideBuildDir() });
}

function createParaglideResolvePlugin(paraglideDir: string): import("bun").BunPlugin {
  return {
    name: "paraglide-runtime-cache",
    setup(build) {
      build.onResolve({ filter: /messages\/paraglide\// }, (args) => {
        const rel = args.path.replace(/^.*messages\/paraglide\//, "");
        return { path: join(paraglideDir, rel) };
      });
    },
  };
}

export async function buildAdminToDir(
  appDir: string,
  opts: BuildAdminOptions,
  repoRoot = getRepoRoot(),
): Promise<void> {
  const paraglideDir = resolveParaglideDir(repoRoot);
  const htmlPath = join(appDir, ADMIN_HTML_NAME);
  mkdirSync(opts.outdir, { recursive: true });
  const tailwind = await loadTailwindPlugin();
  const result = await Bun.build({
    entrypoints: [htmlPath],
    target: "bun",
    minify: opts.minify,
    outdir: opts.outdir,
    publicPath: ADMIN_PUBLIC_PATH,
    plugins: [createParaglideResolvePlugin(paraglideDir), tailwind],
    ...(opts.sourcemap ? { sourcemap: "linked" as const } : {}),
    ...(opts.watch
      ? {
          watch: {
            onRebuild(rebuild: { success: boolean; logs: { message: string }[] }) {
              if (!rebuild.success) {
                const detail = rebuild.logs.map((l: { message: string }) => l.message).join("\n");
                console.error(`[admin] dev rebuild 失败: ${detail || "unknown error"}`);
              }
            },
          },
        }
      : {}),
  });
  if (!result.success) {
    const detail = result.logs.map((l) => l.message).join("\n");
    throw new Error(`Admin 构建失败: ${detail || "unknown error"}`);
  }
  if (!isBuiltHtmlValid(join(opts.outdir, ADMIN_HTML_NAME))) {
    throw new Error(`Admin 构建未产出有效的 ${ADMIN_HTML_NAME}`);
  }
}

async function buildAdminToCache(hash: string, appDir: string): Promise<string> {
  const outdir = cacheDirForHash(hash);
  await buildAdminToDir(appDir, { outdir, minify: true });
  writeBuildManifest(hash);
  pruneStaleBuildCaches(hash);
  return outdir;
}

async function ensureProductionCacheDir(): Promise<string> {
  const bundled = resolveBundledAdminDistDir();
  if (bundled) {
    cachedProductionDir = bundled;
    return bundled;
  }

  const appDir = adminAppDir();
  const hash = computeAdminSourceHash(appDir);
  if (cachedProductionDir && isProductionCacheValid(hash)) {
    return cachedProductionDir;
  }
  if (!isProductionCacheValid(hash)) {
    cachedProductionDir = await buildAdminToCache(hash, appDir);
  } else {
    cachedProductionDir = cacheDirForHash(hash);
  }
  return cachedProductionDir;
}

/** dev：每次启动 AOT 构建 + watch；与生产相同静态 Serving，避免 HTMLBundle HMR 丢样式 */
export async function ensureAdminDevCacheDir(): Promise<string> {
  if (cachedDevDir && isBuiltHtmlValid(join(cachedDevDir, ADMIN_HTML_NAME))) {
    return cachedDevDir;
  }
  const appDir = adminAppDir();
  const outdir = PATHS.adminDevBuildDir;
  rmSync(outdir, { recursive: true, force: true });
  await buildAdminToDir(appDir, { outdir, minify: false, watch: true, sourcemap: true });
  cachedDevDir = outdir;
  return outdir;
}

export async function ensureAdminProductionCacheDir(): Promise<string> {
  return ensureProductionCacheDir();
}

export function releaseAdminHtmlBundle(): void {
  cachedProductionDir = null;
  cachedDevDir = null;
}

export { ADMIN_PUBLIC_PATH };

export type BuildAdminAppOptions = {
  outdir?: string;
  minify?: boolean;
};

/** 构建 Admin SPA 静态资源（desktop / mobile bundled） */
export async function buildAdminApp(opts: BuildAdminAppOptions = {}): Promise<string> {
  const repoRoot = getRepoRoot();
  const outdir = opts.outdir ?? join(import.meta.dir, "dist");
  const minify = opts.minify ?? true;
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const appDir = resolveAdminAppDir(repoRoot);
  await buildAdminToDir(appDir, { outdir, minify }, repoRoot);
  return outdir;
}
