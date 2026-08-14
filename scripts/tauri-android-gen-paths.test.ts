import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import { resolveTauriAndroidMain } from "./tauri-android-gen-paths.ts";

describe("resolveTauriAndroidMain", () => {
  it("resolves freeanima_portal module (Cargo package name)", () => {
    const root = createTempDir("tauri-android-gen-");
    try {
      const main = join(
        root,
        "packages/frontend/portal/app/tauri/src-tauri/gen/android/freeanima_portal/src/main",
      );
      mkdirSync(main, { recursive: true });
      writeFileSync(join(main, "AndroidManifest.xml"), "<manifest/>\n");
      expect(resolveTauriAndroidMain(root)).toBe(main);
    } finally {
      removeTempDir(root);
    }
  });

  it("falls back to portal if present", () => {
    const root = createTempDir("tauri-android-gen-");
    try {
      const main = join(
        root,
        "packages/frontend/portal/app/tauri/src-tauri/gen/android/portal/src/main",
      );
      mkdirSync(main, { recursive: true });
      writeFileSync(join(main, "AndroidManifest.xml"), "<manifest/>\n");
      expect(resolveTauriAndroidMain(root)).toBe(main);
    } finally {
      removeTempDir(root);
    }
  });

  it("returns null when gen missing", () => {
    const root = createTempDir("tauri-android-gen-");
    try {
      expect(resolveTauriAndroidMain(root)).toBeNull();
    } finally {
      removeTempDir(root);
    }
  });
});
