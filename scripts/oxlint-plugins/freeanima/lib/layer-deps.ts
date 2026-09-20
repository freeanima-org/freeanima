/**
 * 仓库层依赖矩阵（SSOT）。
 *
 * 每个层 = 一个 workspace 包；本文件同时服务：
 *   - oxlint 规则 `freeanima/layer-deps`（单文件即时反馈，按说明符判定）
 *   - `scripts/check-layer-deps.ts`（全仓扫描）
 *
 * 判定对**相对路径**同样生效（词法解算后再分层）。
 * `@freeanima/features/*` / `@freeanima/portal/*` 是双树别名（服务端 features
 * vs 前端 ui-features；portal 宿主 vs cli），按**文件存在性**解算。
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./repo-path.ts";

/** 目标包（层）名。 */
export const LAYER_PACKAGES = [
  "shared",
  "kernel",
  "core",
  "engine",
  "capabilities",
  "features",
  "server",
  "cli",
  "ui-kit",
  "portal-sdk",
  "ui-features",
  "app-frame",
  "portal",
] as const;

export type LayerName = (typeof LAYER_PACKAGES)[number];

const LAYER_SET: ReadonlySet<string> = new Set(LAYER_PACKAGES);

/** 允许的依赖方向（目标 DAG）。src 只能 import 其中的 dst。 */
export const LAYER_ALLOWED: Readonly<Record<LayerName, readonly LayerName[]>> = {
  shared: [],
  kernel: ["shared"],
  core: ["kernel", "shared"],
  engine: ["core", "kernel", "shared"],
  capabilities: ["engine", "core", "kernel", "shared"],
  features: ["capabilities", "engine", "core", "kernel", "shared"],
  server: ["features", "capabilities", "engine", "core", "kernel", "shared"],
  // 入口/组合根（同 server）：可依赖全部服务端包
  cli: ["server", "features", "capabilities", "engine", "core", "kernel", "shared"],
  "ui-kit": ["shared"],
  "portal-sdk": ["ui-kit", "shared"],
  "ui-features": ["portal-sdk", "ui-kit", "shared"],
  "app-frame": ["ui-features", "portal-sdk", "ui-kit", "shared"],
  portal: ["app-frame", "ui-features", "portal-sdk", "ui-kit", "shared"],
};

/** 前端侧层（不得触碰 drizzle / core 的 DB 层）。 */
export const FRONTEND_LAYERS: ReadonlySet<string> = new Set([
  "ui-kit",
  "portal-sdk",
  "ui-features",
  "app-frame",
  "portal",
]);

/**
 * 构建工具链文件（vite/wxt 配置与 satellite build 入口）不属于运行时层：
 * 它们只产出 bundle，不参与产物依赖图，因此不参与 DAG 判定。
 */
const BUILD_TOOLING_RE = /(^|\/)((vite|wxt)(\.[a-z0-9-]+)*\.config|build(-[a-z0-9-]+)?)\.tsx?$/;

/** `packages/<x>/...` 的仓库相对路径 → 层名；非层路径/构建工具返回 null。 */
export function layerOfPath(rel: string): string | null {
  const normalizedToolingPath = rel.replaceAll("\\", "/");
  if (BUILD_TOOLING_RE.test(normalizedToolingPath)) return null;
  const segments = rel.replaceAll("\\", "/").split("/");
  if (segments[0] !== "packages") return null;
  const pkg = segments[1];
  if (!pkg) return null;
  if (LAYER_SET.has(pkg)) return pkg;
  return null;
}

/** 词法解算相对说明符（不检查文件是否存在）。 */
function resolveRelative(fromRel: string, spec: string): string | null {
  const stack = fromRel.replaceAll("\\", "/").split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

/** 首次命中的候选目录。 */
function firstExisting(candidates: readonly string[]): string | null {
  for (const base of candidates) {
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ]) {
      if (existsSync(join(REPO_ROOT, candidate))) return candidate;
    }
  }
  return null;
}

/** 双树别名的存在性解算；非双树别名返回 null。 */
function dualTreeLayer(rest: string): string | null {
  const [head, ...tail] = rest.split("/");
  let candidates: string[][] | null = null;
  if (head === "features") {
    candidates = [
      ["packages/ui-features", ...tail],
      ["packages/features", ...tail],
    ];
  } else if (head === "portal") {
    candidates = [
      ["packages/portal", ...tail],
      ["packages/cli", ...tail],
    ];
  }
  if (!candidates) return null;
  const hit = firstExisting(candidates.map((segments) => segments.join("/")));
  return hit ? layerOfPath(hit) : null;
}

/** 说明符 → 层名；无法归层返回 null。 */
export function targetLayer(fromRel: string, spec: string): string | null {
  if (spec.startsWith(".")) {
    const resolved = resolveRelative(fromRel, spec);
    return resolved ? layerOfPath(resolved) : null;
  }
  if (!spec.startsWith("@freeanima/")) return null;
  const rest = spec.slice("@freeanima/".length);
  if (rest.startsWith("features/") || rest === "features" || rest.startsWith("portal/")) {
    const resolved = dualTreeLayer(rest);
    if (resolved) return resolved;
  }
  const parts = rest.split("/");
  const head = parts[0];
  if (!head) return null;
  if (LAYER_SET.has(head)) return head;
  return null;
}

function isDbImport(spec: string): boolean {
  if (spec === "drizzle-orm" || spec.startsWith("drizzle-orm/")) return true;
  return /(?:^|\/)core\/db(?:\/|$)/.test(spec) || spec.startsWith("@freeanima/core/db");
}

function isLayer(value: string | null): value is LayerName {
  return value !== null && LAYER_SET.has(value);
}

/** 层对判定本体（层名由调用方给出：词法或按文件存在性解算）。 */
export function checkLayerEdge(
  from: string | null,
  to: string | null,
  spec: string,
): string | null {
  if (from && FRONTEND_LAYERS.has(from) && isDbImport(spec)) {
    return `${from} 不得 import drizzle-orm 或 core/db；请用 @freeanima/shared/pg-shapes`;
  }

  if (!from || !to || from === to) return null;
  if (!isLayer(from) || !isLayer(to)) return null;

  const allowed = LAYER_ALLOWED[from];
  if (allowed.includes(to)) return null;

  return `${from} 不得依赖 ${to}（允许：${allowed.length > 0 ? allowed.join(", ") : "无"}）`;
}

/** 层依赖违规原因；合法返回 null。 */
export function checkLayerDeps(rel: string, spec: string): string | null {
  return checkLayerEdge(layerOfPath(rel), targetLayer(rel, spec), spec);
}
