/**
 * 编译期壳目标（Vite `define` / `FREEANIMA_SHELL_TARGET`）。
 * 与运行时 `getShellKind()` 正交：前者固定产物形态（desktop/mobile），后者为 web|tauri。
 */

export type ShellBuildTarget = "web" | "desktop" | "mobile";

export const SHELL_BUILD_TARGETS: readonly ShellBuildTarget[] = ["web", "desktop", "mobile"];

declare const __FREEANIMA_SHELL_TARGET__: ShellBuildTarget | undefined;

let testOverride: ShellBuildTarget | null = null;

/** 单测注入；传 `null` 清除。 */
export function setShellBuildTargetForTests(target: ShellBuildTarget | null): void {
  testOverride = target;
}

/** 解析 env / CLI 原始值；非法则抛错。缺省 / 空白 → `web`。 */
export function parseShellBuildTarget(raw: string | undefined | null): ShellBuildTarget {
  const v = (raw ?? "web").trim().toLowerCase() || "web";
  if (v === "web" || v === "desktop" || v === "mobile") return v;
  throw new Error(
    `Invalid FREEANIMA_SHELL_TARGET=${JSON.stringify(raw)}; expected web|desktop|mobile`,
  );
}

/** Vite outDir 目录名（相对 `src/portal/app/web/`）。 */
export function shellWebDistDirName(target: ShellBuildTarget): string {
  switch (target) {
    case "web":
      return "dist";
    case "desktop":
      return "dist-desktop";
    case "mobile":
      return "dist-mobile";
    default: {
      const _exhaustive: never = target;
      throw new Error(`Unhandled shell build target: ${String(_exhaustive)}`);
    }
  }
}

/**
 * 读取编译期壳目标。
 * 优先测试覆盖，其次 Vite `define` 注入的 `__FREEANIMA_SHELL_TARGET__`，
 * 再次 `process.env.FREEANIMA_SHELL_TARGET`（bun/脚本构建），否则 `web`。
 */
export function getShellBuildTarget(): ShellBuildTarget {
  if (testOverride) return testOverride;
  try {
    if (typeof __FREEANIMA_SHELL_TARGET__ !== "undefined") {
      const injected = __FREEANIMA_SHELL_TARGET__;
      if (injected === "web" || injected === "desktop" || injected === "mobile") {
        return injected;
      }
    }
  } catch {
    /* bun 单测未 define 时可能 ReferenceError */
  }
  try {
    const fromEnv =
      typeof process !== "undefined" ? process.env?.FREEANIMA_SHELL_TARGET : undefined;
    if (fromEnv != null && fromEnv.trim() !== "") {
      return parseShellBuildTarget(fromEnv);
    }
  } catch {
    /* 浏览器无 process */
  }
  return "web";
}
