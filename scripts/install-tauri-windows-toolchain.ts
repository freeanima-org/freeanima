#!/usr/bin/env bun
/**
 * 安装 / 校验 Tauri Windows 交叉打包工具链（Linux/macOS → NSIS）。
 *
 *   bun scripts/install-tauri-windows-toolchain.ts           # 安装
 *   bun scripts/install-tauri-windows-toolchain.ts --apt     # 含 sudo apt
 *   bun scripts/install-tauri-windows-toolchain.ts --check   # 仅校验（供 just pack 依赖）
 */
import { spawnSync } from "node:child_process";

const TARGET = "x86_64-pc-windows-msvc";
const withApt = process.argv.includes("--apt");
const checkOnly = process.argv.includes("--check");
const HINT = "just install tauri-windows\n  # 或缺系统包：just install tauri-windows -- --apt";

function which(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

function ok(cmd: string, args: string[]): boolean {
  return spawnSync(cmd, args, { stdio: "ignore", shell: false }).status === 0;
}

/** cc-rs 交叉编 MSVC 目标需要 `llvm-lib`；apt 的 llvm 常只装版本化名。 */
function ensureLlvmLibOnPath(): void {
  if (which("llvm-lib")) return;
  const probe = spawnSync(
    "sh",
    ["-c", "command -v llvm-lib-18 || command -v llvm-lib-17 || command -v llvm-lib-16 || true"],
    { encoding: "utf-8", shell: false },
  );
  const versioned = (probe.stdout ?? "").trim().split("\n")[0]?.trim();
  if (!versioned) return;
  const link = spawnSync("sudo", ["ln", "-sfn", versioned, "/usr/local/bin/llvm-lib"], {
    stdio: "inherit",
    shell: false,
  });
  if (link.status === 0 && which("llvm-lib")) {
    console.log(`[install-tauri-windows] llvm-lib → ${versioned}`);
  }
}

function run(cmd: string, args: string[], label: string): void {
  console.log(`[install-tauri-windows] ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, env: process.env });
  if (r.status !== 0) {
    console.error(`[install-tauri-windows] 失败：${label}`);
    process.exit(r.status ?? 1);
  }
}

function failCheck(msg: string): never {
  console.error(`[ensure-tauri-windows] ${msg}\n请先：\n  ${HINT}`);
  process.exit(1);
}

function listMissing(): string[] {
  const missing: string[] = [];
  if (!which("rustup") || !which("cargo")) missing.push("rustup/cargo");
  else {
    const list = spawnSync("rustup", ["target", "list", "--installed"], {
      encoding: "utf-8",
      shell: false,
    });
    if (!(list.stdout ?? "").includes(TARGET)) missing.push(`rust target ${TARGET}`);
    if (!ok("cargo", ["xwin", "--version"])) missing.push("cargo-xwin");
  }
  if (!which("makensis")) missing.push("nsis/makensis");
  if (!which("clang")) missing.push("clang");
  if (!which("lld")) missing.push("lld");
  if (!which("llvm-lib")) missing.push("llvm/llvm-lib");
  return missing;
}

if (checkOnly) {
  ensureLlvmLibOnPath();
  const missing = listMissing();
  if (missing.length > 0) failCheck(`工具链不完整：${missing.join(", ")}`);
  console.log("[ensure-tauri-windows] OK");
  process.exit(0);
}

console.log("[install-tauri-windows] 开始安装交叉编译工具链…");

if (!which("rustup") || !which("cargo")) {
  console.error(
    "[install-tauri-windows] 未找到 rustup/cargo。请先安装 Rust：\n" +
      "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh\n" +
      '  source "$HOME/.cargo/env"',
  );
  process.exit(1);
}

{
  const list = spawnSync("rustup", ["target", "list", "--installed"], {
    encoding: "utf-8",
    shell: false,
  });
  if ((list.stdout ?? "").includes(TARGET)) {
    console.log(`[install-tauri-windows] rust target ${TARGET} 已安装`);
  } else {
    run("rustup", ["target", "add", TARGET], `rustup target add ${TARGET}`);
  }
}

if (ok("cargo", ["xwin", "--version"])) {
  console.log("[install-tauri-windows] cargo-xwin 已安装");
} else {
  run("cargo", ["install", "--locked", "cargo-xwin"], "cargo install --locked cargo-xwin");
}

{
  const missing: string[] = [];
  if (!which("makensis")) missing.push("nsis");
  if (!which("clang")) missing.push("clang");
  if (!which("lld")) missing.push("lld");
  // llvm 提供 llvm-lib（ring/cc-rs 编 MSVC 目标需要）
  if (!which("llvm-lib")) missing.push("llvm");
  // tauri-cli 在 Linux 宿主上打包（含交叉 Windows）会探测 appindicator，缺则 abort
  const appindicatorOk =
    spawnSync("pkg-config", ["--exists", "ayatana-appindicator3-0.1"], {
      stdio: "ignore",
    }).status === 0 ||
    spawnSync("pkg-config", ["--exists", "appindicator3-0.1"], { stdio: "ignore" }).status === 0;
  if (!appindicatorOk) missing.push("libappindicator3-dev");
  if (missing.length === 0) {
    console.log("[install-tauri-windows] nsis / clang / lld / llvm-lib / appindicator 已就绪");
  } else if (process.platform === "linux" && withApt) {
    run("sudo", ["apt-get", "update", "-qq"], "sudo apt-get update");
    run(
      "sudo",
      ["apt-get", "install", "-y", ...missing],
      `sudo apt-get install -y ${missing.join(" ")}`,
    );
    ensureLlvmLibOnPath();
    if (!which("llvm-lib")) {
      console.error(
        "[install-tauri-windows] 已装 llvm 但仍无 llvm-lib；请检查 /usr/bin/llvm-lib-*",
      );
      process.exit(1);
    }
  } else if (process.platform === "linux") {
    console.error(
      `[install-tauri-windows] 缺少：${missing.join(", ")}\n` +
        `  sudo apt-get install -y ${missing.join(" ")}\n` +
        `或：just install tauri-windows -- --apt`,
    );
    process.exit(1);
  } else if (process.platform === "darwin") {
    console.error("[install-tauri-windows] macOS：brew install nsis llvm");
    process.exit(1);
  } else {
    console.error("[install-tauri-windows] 请自行安装 nsis / clang / lld / llvm");
    process.exit(1);
  }
}

ensureLlvmLibOnPath();
console.log("[install-tauri-windows] 完成。下一步：just pack tauri-windows");
process.exit(0);
