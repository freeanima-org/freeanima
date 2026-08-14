import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import {
  packArtifactLegacyAliases,
  packArtifactStableName,
  packArtifactVersionedName,
  resolvePackArtifactMeta,
  sanitizePackVersionToken,
} from "./pack-artifact-names.ts";

describe("sanitizePackVersionToken", () => {
  it("strips v and maps + to .", () => {
    expect(sanitizePackVersionToken("v0.9.2-canary+202607161200")).toBe(
      "0.9.2-canary.202607161200",
    );
    expect(sanitizePackVersionToken("0.11.0-local+202608070617")).toBe("0.11.0-local.202608070617");
  });
});

describe("packArtifactVersionedName", () => {
  const meta = {
    channel: "local" as const,
    version: "0.9.2-local+202608070617",
    versionToken: "0.9.2-local.202608070617",
  };

  it("builds desktop windows name", () => {
    expect(packArtifactVersionedName("desktop-windows-nsis", meta)).toBe(
      "freeanima-desktop-windows-x64-0.9.2-local.202608070617-local-setup.exe",
    );
  });

  it("builds browser-extension zip name", () => {
    expect(packArtifactVersionedName("browser-extension-zip", meta)).toBe(
      "freeanima-browser-extension-0.9.2-local.202608070617-local.zip",
    );
  });

  it("builds browser-extension firefox xpi name", () => {
    expect(packArtifactVersionedName("browser-extension-firefox-xpi", meta)).toBe(
      "freeanima-browser-extension-firefox-0.9.2-local.202608070617-local.xpi",
    );
  });

  it("builds canary android name", () => {
    expect(
      packArtifactVersionedName("mobile-android-apk", {
        channel: "canary",
        version: "0.9.2-canary+202607161200",
        versionToken: "0.9.2-canary.202607161200",
      }),
    ).toBe("freeanima-mobile-android-0.9.2-canary.202607161200-canary.apk");
  });
});

describe("packArtifactStableName", () => {
  it("keeps updater fixed names", () => {
    expect(packArtifactStableName("desktop-windows-nsis")).toBe(
      "freeanima-desktop-windows-x64-setup.exe",
    );
    expect(packArtifactStableName("standalone-linux-tarball")).toBe("anima-linux-x64.tar.gz");
  });
});

describe("packArtifactLegacyAliases", () => {
  it("keeps local script aliases for windows/android", () => {
    expect(packArtifactLegacyAliases("desktop-windows-nsis")).toContain(
      "freeanima-desktop-tauri-windows-x64-setup.exe",
    );
    expect(packArtifactLegacyAliases("mobile-android-apk")).toContain(
      "freeanima-mobile-tauri-android.apk",
    );
  });
});

describe("resolvePackArtifactMeta", () => {
  it("defaults channel to local and stamps version when env unset", () => {
    const dir = createTempDir("freeanima-pack-meta-");
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.11.0" }));
      const meta = resolvePackArtifactMeta(dir, {});
      expect(meta.channel).toBe("local");
      expect(meta.version).toMatch(/^0\.11\.0-local\+\d{12}$/);
      expect(meta.versionToken).toMatch(/^0\.11\.0-local\.\d{12}$/);
    } finally {
      removeTempDir(dir);
    }
  });

  it("defaults channel to local and reads FREEANIMA_BUILD_VERSION", () => {
    const meta = resolvePackArtifactMeta(undefined, {
      FREEANIMA_BUILD_VERSION: "v1.2.3",
    });
    expect(meta.channel).toBe("local");
    expect(meta.version).toBe("1.2.3");
    expect(meta.versionToken).toBe("1.2.3");
  });
});
