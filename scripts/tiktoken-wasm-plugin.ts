/**
 * Bun.build 插件：standalone `--compile` 时改写 tiktoken CJS 入口的 wasm 加载。
 *
 * tiktoken.cjs 用 `fs.readFileSync` + 构建机 `__dirname` 找 `tiktoken_bg.wasm`；
 * 发版机路径在用户机不存在 → Missing tiktoken_bg.wasm。
 * 改为把 wasm 拷到构建 staging 再 `with { type: "file" }` 嵌入（与 migration/web 同机制）。
 */
import type { BunPlugin } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

export function resolveTiktokenWasmPath(repoRoot: string): string {
  const require = createRequire(join(repoRoot, "package.json"));
  const tiktokenDir = dirname(require.resolve("tiktoken/package.json"));
  const wasmPath = join(tiktokenDir, "tiktoken_bg.wasm");
  if (!existsSync(wasmPath)) {
    throw new Error(`tiktoken_bg.wasm not found at ${wasmPath}`);
  }
  return wasmPath;
}

function isTiktokenMainCjs(filePath: string): boolean {
  const normalized = filePath.split(/[/\\]/).join("/");
  return normalized.endsWith("/tiktoken/tiktoken.cjs");
}

/**
 * @param wasmAbsPath 嵌入用的 wasm 绝对路径（应在 staging，勿直接用 node_modules 路径，
 *   以免二进制残留构建机 tiktoken 包目录字符串）
 */
export function createTiktokenWasmPlugin(wasmAbsPath: string): BunPlugin {
  return {
    name: "freeanima-tiktoken-wasm",
    setup(build) {
      build.onLoad({ filter: /tiktoken\.cjs$/ }, (args) => {
        if (!isTiktokenMainCjs(args.path)) return undefined;

        // Relative import 相对原包路径解析并静态打进 bundle；勿 createRequire（compile 后会变成运行时解析）。
        const contents = `/** AUTO by scripts/tiktoken-wasm-plugin.ts — embed wasm for bun --compile */
import { readFileSync } from "node:fs";
import __faTiktokenWasmPath from ${JSON.stringify(wasmAbsPath)} with { type: "file" };
import * as wasmNs from "./tiktoken_bg.cjs";

const wasm = "default" in wasmNs && wasmNs.default ? wasmNs.default : wasmNs;
const imports = { "./tiktoken_bg.js": wasm };

let bytes = null;
try {
  bytes = readFileSync(__faTiktokenWasmPath);
} catch {}
if (bytes == null) throw new Error("Missing tiktoken_bg.wasm");

const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
wasm.__wbg_set_wasm(wasmInstance.exports);

export const get_encoding = wasm.get_encoding;
export const encoding_for_model = wasm.encoding_for_model;
export const get_encoding_name_for_model = wasm.get_encoding_name_for_model;
export const Tiktoken = wasm.Tiktoken;
`;
        return { contents, loader: "js" };
      });
    },
  };
}

/**
 * 冒烟：二进制不应再含构建机 node_modules/tiktoken 包目录（旧 loader bake `__dirname`）。
 */
export function assertStandaloneBinaryHasNoTiktokenBuildPath(
  binaryPath: string,
  tiktokenPackageDir: string,
): void {
  const bytes = readFileSync(binaryPath);
  const needle = Buffer.from(tiktokenPackageDir.split(sep).join("/"), "utf8");
  if (bytes.includes(needle)) {
    throw new Error(
      `standalone binary still contains tiktoken build path ${tiktokenPackageDir}; wasm loader patch may have failed`,
    );
  }
}
