/**
 * Tauri/Cargo 打包加速用环境变量：sccache、mold、CARGO_BUILD_JOBS。
 * 仅在命令存在且调用方未显式设置时注入，避免破坏无工具链的机器。
 */
import { spawnSync } from "node:child_process";
import { cpus } from "node:os";

function commandExists(name: string): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(finder, [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0;
}

/** 默认并行度：本机 CPU 数，夹在 [2, 8]；交叉 Windows 调用方可先设为 4。 */
export function defaultCargoBuildJobs(cpuCount: number = cpus().length): number {
  const n = Number.isFinite(cpuCount) && cpuCount > 0 ? Math.floor(cpuCount) : 4;
  return Math.max(2, Math.min(n, 8));
}

export type TauriRustBuildEnvOptions = {
  /** 日志前缀，如 `[pack tauri]`；空则不打印 */
  logPrefix?: string;
  /** 未设置 CARGO_BUILD_JOBS 时的默认值 */
  defaultJobs?: number;
};

/**
 * 合并加速相关 env。不修改传入对象；返回新对象。
 */
export function resolveTauriRustBuildEnv(
  base: NodeJS.ProcessEnv = process.env,
  opts: TauriRustBuildEnvOptions = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  const log = opts.logPrefix;
  const notes: string[] = [];

  if (!env.RUSTC_WRAPPER?.trim() && commandExists("sccache")) {
    env.RUSTC_WRAPPER = "sccache";
    notes.push("RUSTC_WRAPPER=sccache");
  }

  if (process.platform === "linux") {
    const existing = env.RUSTFLAGS ?? "";
    const hasFuseLd = /(-C\s+link-arg=)?-fuse-ld=/.test(existing);
    if (!hasFuseLd) {
      if (commandExists("mold")) {
        env.RUSTFLAGS = [existing, "-C", "link-arg=-fuse-ld=mold"].filter(Boolean).join(" ");
        notes.push("mold");
      } else if (commandExists("lld")) {
        env.RUSTFLAGS = [existing, "-C", "link-arg=-fuse-ld=lld"].filter(Boolean).join(" ");
        notes.push("lld");
      }
    }
  }

  if (!env.CARGO_BUILD_JOBS?.trim()) {
    const jobs = opts.defaultJobs ?? defaultCargoBuildJobs();
    env.CARGO_BUILD_JOBS = String(jobs);
    notes.push(`CARGO_BUILD_JOBS=${jobs}`);
  }

  if (log && notes.length > 0) {
    console.log(`${log} rust accel: ${notes.join(", ")}`);
  }
  return env;
}
