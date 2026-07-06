import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";

import { assertElectronMainBundle } from "./electron-main-bundle-assert.ts";
import { getElectronMainBundleOptions } from "./build-electron.ts";

const SHELL_ROOT = import.meta.dir;
const MAIN_BUNDLE_PATH = join(SHELL_ROOT, "electron-dist", "main.cjs");

describe("desktop electron main bundle", () => {
  it("打包后无 external npm require，且内联 electron-store", async () => {
    await esbuild.build(getElectronMainBundleOptions());
    const code = readFileSync(MAIN_BUNDLE_PATH, "utf-8");
    expect(() => assertElectronMainBundle(code)).not.toThrow();
    expect(code).not.toMatch(/require\(["']electron-store["']\)/);
  });

  it("断言能拦截危险的 external require", () => {
    expect(() => assertElectronMainBundle('require("commander")')).toThrow(
      /commander 不得 external/,
    );
    expect(() => assertElectronMainBundle('require("electron-store")')).toThrow(
      /electron-store 不得 external/,
    );
    expect(() => assertElectronMainBundle("const x = 1")).toThrow(/electron-store/);
  });
});
