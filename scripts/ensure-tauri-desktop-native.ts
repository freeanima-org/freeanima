#!/usr/bin/env bun
/**
 * 本机（宿主平台）打桌面壳 / `just dev tauri` 前的工具链检查。
 *
 *   bun scripts/ensure-tauri-desktop-native.ts           # check + 提示
 *   bun scripts/ensure-tauri-desktop-native.ts --check   # 同上（供 just 依赖）
 *   bun scripts/ensure-tauri-desktop-native.ts --require linux|windows|darwin
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const args = process.argv.slice(2);
const requireOs = (() => {
  const i = args.indexOf("--require");
  if (i < 0) return null;
  return args[i + 1]?.trim().toLowerCase() || null;
})();

function fail(msg: string): never {
  console.error(`[ensure-tauri-desktop] ${msg}`);
  process.exit(1);
}

function which(cmd: string): boolean {
  const r =
    process.platform === "win32"
      ? spawnSync("where", [cmd], { stdio: "ignore", shell: true })
      : spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
  return r.status === 0;
}

function ensureRust(): void {
  if (!which("cargo") || !which("rustc")) {
    fail("未找到 cargo/rustc。请先安装 Rust：https://rustup.rs/");
  }
}

function ensureLinux(): void {
  ensureRust();
  const check = spawnSync("pkg-config", ["--exists", "javascriptcoregtk-4.1", "webkit2gtk-4.1"], {
    stdio: "ignore",
  });
  if (check.status === 0) return;
  fail(
    "缺少 Linux WebKitGTK 开发库。\n" +
      "  just install tauri\n" +
      "  # 或：just install tauri-linux -- --apt",
  );
}

function findMsvcLink(): string | null {
  if (which("link")) {
    const where = spawnSync("where", ["link"], { encoding: "utf-8", shell: true });
    const first = (where.stdout ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (first && /MSVC|Visual Studio/i.test(first)) return first;
    // where 可能命中无用的其他 link.exe；继续扫 VS 安装树
  }
  const vswhere =
    process.env["ProgramFiles(x86)"] != null
      ? `${process.env["ProgramFiles(x86)"]}\\Microsoft Visual Studio\\Installer\\vswhere.exe`
      : "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
  if (!existsSync(vswhere)) return null;
  // 勿 shell:true：带空格的 vswhere 路径在 cmd 下易被拆坏
  const r = spawnSync(
    vswhere,
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ],
    { encoding: "utf-8" },
  );
  const ip = (r.stdout ?? "").replace(/\r/g, "").trim();
  if (!ip) return null;
  // 常见：VC\Tools\MSVC\<ver>\bin\Hostx64\x64\link.exe
  const msvcRoot = `${ip}\\VC\\Tools\\MSVC`;
  if (!existsSync(msvcRoot)) return null;
  try {
    const vers = readdirSync(msvcRoot).toSorted().toReversed();
    for (const v of vers) {
      const link = `${msvcRoot}\\${v}\\bin\\Hostx64\\x64\\link.exe`;
      if (existsSync(link)) return link;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function ensureWindows(): void {
  ensureRust();
  const link = findMsvcLink();
  if (link) {
    console.log(`[ensure-tauri-desktop] MSVC link OK: ${link}`);
    return;
  }
  fail(
    "未找到 MSVC link.exe（x86_64-pc-windows-msvc 需要 Visual Studio Build Tools）。\n" +
      "  安装（管理员 / UAC）：\n" +
      "    winget install Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements \\\n" +
      '      --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"\n' +
      "  或：just install tauri\n" +
      "  打包/开发前请在「x64 Native Tools」或先调用 vcvars64.bat，确保 PATH 含 MSVC。",
  );
}

function ensureDarwin(): void {
  ensureRust();
  // Xcode CLT 通常够用；缺了让 cargo/tauri 报更具体错误
  console.log(
    "[ensure-tauri-desktop] macOS：请确保已装 Xcode Command Line Tools（xcode-select --install）",
  );
}

const platform = process.platform;
if (requireOs) {
  const want =
    requireOs === "linux"
      ? "linux"
      : requireOs === "windows" || requireOs === "win32"
        ? "win32"
        : requireOs === "darwin" || requireOs === "macos"
          ? "darwin"
          : null;
  if (!want) fail(`未知 --require ${requireOs}（支持 linux|windows|darwin）`);
  if (platform !== want) {
    fail(
      `当前平台为 ${platform}，此配方要求 ${want}。\n` +
        "  本机打包请用：just pack tauri\n" +
        "  交叉打 Windows（非 Windows 宿主）：just pack tauri-windows",
    );
  }
}

if (platform === "linux") ensureLinux();
else if (platform === "win32") ensureWindows();
else if (platform === "darwin") ensureDarwin();
else fail(`不支持的桌面宿主平台：${platform}`);

console.log(`[ensure-tauri-desktop] OK (${platform})`);
