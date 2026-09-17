/** 壳更新 toast 进度文案（纯函数，便于单测） */

export function formatProgressBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${Math.floor(n)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export type ShellApplyProgress = {
  received: number;
  total: number | null;
  phase: "downloading" | "installing";
};

export function formatApplyingMessage(progress: ShellApplyProgress | null): string {
  if (progress?.phase === "installing") {
    return "正在安装…";
  }
  if (!progress) {
    return "正在下载并安装…";
  }
  if (progress.total != null && progress.total > 0) {
    const percent = Math.min(100, Math.floor((100 * progress.received) / progress.total));
    return `下载中… ${String(percent)}%`;
  }
  return `下载中… ${formatProgressBytes(progress.received)}`;
}
