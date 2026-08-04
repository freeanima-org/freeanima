#!/usr/bin/env bun
/**
 * `just install tauri`：按宿主平台安装/提示桌面壳本机依赖。
 *
 * Linux → install-tauri-linux-deps.ts（可传 --apt）
 * Windows → 检查 MSVC；缺则打印 winget 安装命令（不自动提权）
 * macOS → Xcode CLT 提示
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const passthrough = process.argv.slice(2);

if (process.platform === "linux") {
  const r = spawnSync("bun", ["scripts/install-tauri-linux-deps.ts", ...passthrough], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

if (process.platform === "win32") {
  const check = spawnSync("bun", ["scripts/ensure-tauri-desktop-native.ts", "--check"], {
    cwd: root,
    stdio: "inherit",
  });
  if (check.status === 0) {
    console.log(
      "[install tauri] Windows 本机工具链已就绪。下一步：just pack tauri / just dev tauri",
    );
    process.exit(0);
  }
  console.log(
    [
      "[install tauri] 请管理员安装 VS 2022 Build Tools（C++）：",
      "  winget install Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements \\",
      '    --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"',
      "装完后新开终端，或先：",
      '  call "%ProgramFiles(x86)%\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat"',
      "再：just pack tauri / just dev tauri",
    ].join("\n"),
  );
  process.exit(check.status ?? 1);
}

if (process.platform === "darwin") {
  console.log(
    "[install tauri] macOS：xcode-select --install；Rust：https://rustup.rs/\n" +
      "就绪后：just pack tauri / just dev tauri",
  );
  const r = spawnSync("bun", ["scripts/ensure-tauri-desktop-native.ts", "--check"], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(r.status ?? 0);
}

console.error(`[install tauri] 不支持的平台：${process.platform}`);
process.exit(1);
