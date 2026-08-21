import { isRecord } from "@freeanima/shared/util";
import type { Writable } from "node:stream";

import type { DownloadProgress } from "./download.ts";

/** 近似 wget 的人类可读字节（1024 进制） */
export function formatHumanBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0B";
  if (n < 1024) return `${Math.floor(n)}B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)}K`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}M`;
  return `${(n / 1024 ** 3).toFixed(2)}G`;
}

export function formatCliDownloadProgressLine(opts: {
  fileName: string;
  received: number;
  total: number | null;
  barWidth?: number;
  /** 字节/秒；省略则不显示速率 */
  bytesPerSecond?: number | null;
}): string {
  const barWidth = opts.barWidth ?? 20;
  const name =
    opts.fileName.length > 28 ? `${opts.fileName.slice(0, 25)}...` : opts.fileName.padEnd(28);
  const speed =
    opts.bytesPerSecond != null && opts.bytesPerSecond > 0
      ? `  ${formatHumanBytes(opts.bytesPerSecond)}/s`
      : "";

  if (opts.total != null && opts.total > 0) {
    const pct = Math.min(100, Math.floor((100 * opts.received) / opts.total));
    const filled = Math.min(barWidth, Math.round((barWidth * pct) / 100));
    const head = filled > 0 ? "=".repeat(filled - 1) + ">" : "";
    const bar = head + " ".repeat(Math.max(0, barWidth - filled));
    return `${name} ${String(pct).padStart(3)}%[${bar}] ${formatHumanBytes(opts.received).padStart(6)} / ${formatHumanBytes(opts.total)}${speed}`;
  }

  return `${name}      ${formatHumanBytes(opts.received).padStart(6)}${speed}`;
}

export type CliDownloadProgressSink = {
  onProgress: (progress: DownloadProgress) => void;
  finish: () => void;
};

/**
 * TTY 下用 \\r 重绘单行进度（类 wget）；非 TTY 不输出，避免污染日志/管道。
 */
export function createCliDownloadProgressSink(opts: {
  fileName: string;
  stream?: Writable;
  isTty?: boolean;
  nowMs?: () => number;
}): CliDownloadProgressSink {
  const stream = opts.stream ?? process.stderr;
  const nowMs = opts.nowMs ?? Date.now;
  const streamRec = isRecord(stream) ? stream : null;
  const isTty = opts.isTty ?? (typeof streamRec?.isTTY === "boolean" && streamRec.isTTY);
  let wrote = false;
  const startedAt = nowMs();
  let lastReceived = 0;
  let lastAt = startedAt;

  return {
    onProgress(progress) {
      if (!isTty) return;
      const now = nowMs();
      const dt = Math.max(1, now - lastAt);
      const delta = progress.received - lastReceived;
      const bytesPerSecond =
        delta > 0
          ? (delta * 1000) / dt
          : progress.received > 0
            ? (progress.received * 1000) / Math.max(1, now - startedAt)
            : null;
      lastReceived = progress.received;
      lastAt = now;
      const line = formatCliDownloadProgressLine({
        fileName: opts.fileName,
        received: progress.received,
        total: progress.total,
        ...(bytesPerSecond != null ? { bytesPerSecond } : {}),
      });
      stream.write(`\r${line}`);
      wrote = true;
    },
    finish() {
      if (!isTty || !wrote) return;
      stream.write("\n");
      wrote = false;
    },
  };
}
