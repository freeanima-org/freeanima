import { logComponent } from "@freeanima/host/platform/logging";

import {
  ensureAcmeMaterialWithMeta,
  type EnsureAcmeMaterialOptions,
} from "./ensure-acme-material.ts";

export type AcmeRenewalSchedulerOptions = {
  email: string;
  domains: string[];
  certPath: string;
  keyPath: string;
  staging?: boolean;
  accountPath?: string;
  /** 检查间隔 ms（默认 12h） */
  intervalMs?: number;
  /** 续期成功后回调（用于重启 HTTPS） */
  onRenewed: (material: { certPath: string; keyPath: string }) => void | Promise<void>;
  issueFn?: EnsureAcmeMaterialOptions["issueFn"];
};

export type AcmeRenewalScheduler = {
  stop: () => void;
};

const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * 定时检查 ACME 证书；到期前续期并回调 onRenewed（仅真正重签时）。
 */
export function startAcmeRenewalScheduler(
  options: AcmeRenewalSchedulerOptions,
): AcmeRenewalScheduler {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let stopped = false;
  let running = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await ensureAcmeMaterialWithMeta({
        certPath: options.certPath,
        keyPath: options.keyPath,
        email: options.email,
        domains: options.domains,
        ...(options.staging !== undefined ? { staging: options.staging } : {}),
        ...(options.accountPath ? { accountPath: options.accountPath } : {}),
        ...(options.issueFn ? { issueFn: options.issueFn } : {}),
      });
      if (result.renewed) {
        await options.onRenewed(result.material);
      }
    } catch (err) {
      logComponent("startup").warn("ACME 续期检查失败", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
