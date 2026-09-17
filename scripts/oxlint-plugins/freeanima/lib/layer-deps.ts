/**
 * 仓库层依赖矩阵（SSOT）。
 *
 * 大重构后每个层 = 一个 workspace 包；本文件同时服务：
 *   - oxlint 规则 `freeanima/layer-deps`（单文件即时反馈，按说明符判定）
 *   - `scripts/check-layer-deps.ts`（全仓扫描 + 存量基线收敛）
 *
 * 判定对**相对路径**同样生效（词法解算后再分层），补上旧实现的最大漏洞。
 * `@freeanima/features/*` / `@freeanima/portal/*` 是双树别名，按**文件存在性**
 * 解算（frontend 优先，与 tsconfig/Vite 一致）。
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

/** 当前布局（P4/P5 迁移前）的目录 → 层映射。 */
function currentLayoutLayer(segments: readonly string[]): string | null {
  if (segments[0] === "shared") return "shared";
  if (segments[0] === "habitat") {
    switch (segments[1]) {
      case "kernel":
        return "kernel";
      case "core":
        return "core";
      case "engine":
        return "engine";
      case "capabilities":
        return "capabilities";
      case "features":
        return "features";
      default:
        // platform/、portal/（CLI）等
        return "server";
    }
  }
  if (segments[0] === "frontend") {
    if (segments[1] === "ui-kit") return "ui-kit";
    if (segments[1] === "features") return "ui-features";
    if (segments[1] === "portal") return "portal";
    if (segments[1] === "client") {
      if (segments[2] === "portal-sdk") return "portal-sdk";
      if (segments[2] === "app-frame") return "app-frame";
    }
  }
  return null;
}

/** `packages/<x>/...` 的仓库相对路径 → 层名；非层路径返回 null。 */
export function layerOfPath(rel: string): string | null {
  const segments = rel.replaceAll("\\", "/").split("/");
  if (segments[0] !== "packages") return null;
  const pkg = segments[1];
  if (!pkg) return null;
  if (LAYER_SET.has(pkg)) return pkg;
  if (pkg === "habitat" || pkg === "frontend") return currentLayoutLayer(segments.slice(1));
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

/** 首次命中的候选目录（frontend 优先，与 tsconfig/Vite 一致）。 */
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
      ["packages/frontend/features", ...tail],
      ["packages/features", ...tail],
    ];
  } else if (head === "portal") {
    candidates = [
      ["packages/frontend/portal", ...tail],
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
  const second = parts[1];
  if (!head) return null;
  if (LAYER_SET.has(head)) return head;
  // 当前布局：@freeanima/habitat/<layer>、@freeanima/frontend/<sub>、
  // @freeanima/client/<sub>、@freeanima/{features,portal}（双树）
  if (head === "habitat" && second) return currentLayoutLayer(["habitat", second]);
  if (head === "frontend" && second) {
    if (second === "features") return "ui-features";
    if (second === "portal") return "portal";
    if (second === "ui-kit") return "ui-kit";
    if (second === "client") {
      const third = parts[2];
      if (third === "portal-sdk") return "portal-sdk";
      if (third === "app-frame") return "app-frame";
    }
    return null;
  }
  if (head === "client") {
    if (second === "portal-sdk") return "portal-sdk";
    if (second === "app-frame") return "app-frame";
    return null;
  }
  if (head === "features") return "features";
  if (head === "portal") return "portal";
  if (head === "platform") return "server";
  if (head === "ui-kit") return "ui-kit";
  return null;
}

function isDbImport(spec: string): boolean {
  if (spec === "drizzle-orm" || spec.startsWith("drizzle-orm/")) return true;
  return (
    /(?:^|\/)core\/db(?:\/|$)/.test(spec) ||
    spec.includes("@freeanima/core/db") ||
    spec.includes("@freeanima/host/core/db") ||
    spec.startsWith("@freeanima/core/db")
  );
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
