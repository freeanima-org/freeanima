/**
 * Electron 主进程 Node TLS 默认只含 Mozilla 捆绑根，不含 OS 信任库。
 * mkcert -install / 用户导入的 rootCA.pem 在系统库中；不合并则
 * shell:settings:test、companion Hub HTTPS/WSS 会 UNABLE_TO_VERIFY_LEAF_SIGNATURE。
 * 渲染进程走 Chromium，本模块只修主进程 Node（fetch / ws）。
 */
import tls from "node:tls";

import { logLine } from "./log.ts";

export type TrustSystemCaResult =
  | { ok: true; systemCount: number; mergedCount: number }
  | { ok: false; reason: string };

export type TrustSystemCaCertType = "bundled" | "default" | "extra" | "system";

export type TrustSystemCaDeps = {
  getCACertificates: (type?: TrustSystemCaCertType) => readonly string[];
  setDefaultCACertificates: (certs: readonly string[]) => void;
};

function defaultTrustSystemCaDeps(): TrustSystemCaDeps {
  return {
    getCACertificates: (type) => tls.getCACertificates(type),
    setDefaultCACertificates: (certs) => {
      const setDefault = (
        tls as typeof tls & {
          setDefaultCACertificates?: (certs: readonly string[]) => void;
        }
      ).setDefaultCACertificates;
      if (typeof setDefault !== "function") {
        throw new Error("tls.setDefaultCACertificates 不可用");
      }
      setDefault(certs);
    },
  };
}

function tlsCaApisAvailable(deps: TrustSystemCaDeps): boolean {
  return (
    typeof deps.getCACertificates === "function" &&
    typeof deps.setDefaultCACertificates === "function"
  );
}

export function mergeBundledAndSystemCaCertificates(
  bundled: readonly string[],
  system: readonly string[],
): string[] {
  return [...new Set([...bundled, ...system])];
}

/** 将 OS 信任库 CA 并入 Node 默认信任（保留 bundled Mozilla 根） */
export function trustSystemCaCertificates(
  deps: TrustSystemCaDeps = defaultTrustSystemCaDeps(),
): TrustSystemCaResult {
  if (!tlsCaApisAvailable(deps)) {
    return { ok: false, reason: "Node tls.getCACertificates/setDefaultCACertificates 不可用" };
  }
  try {
    const system = deps.getCACertificates("system");
    const bundled = deps.getCACertificates("bundled");
    if (system.length === 0) {
      return { ok: false, reason: "系统 CA 为空" };
    }
    const merged = mergeBundledAndSystemCaCertificates(bundled, system);
    deps.setDefaultCACertificates(merged);
    return { ok: true, systemCount: system.length, mergedCount: merged.length };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** 须在任何 Hub HTTPS 之前调用（main-entry → main） */
export function applyTrustSystemCaAtStartup(): void {
  const result = trustSystemCaCertificates();
  if (result.ok) {
    logLine(
      `Node TLS: 已合并系统 CA（system=${result.systemCount}, merged=${result.mergedCount}）`,
    );
    return;
  }
  logLine(`Node TLS: 无法加载系统 CA（mkcert HTTPS 可能失败）: ${result.reason}`);
}
