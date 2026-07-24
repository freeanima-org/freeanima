import { describe, expect, it } from "bun:test";

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
  });
});

describe("packArtifactVersionedName", () => {
  const meta = {
    channel: "dev" as const,
    version: "0.9.2",
    versionToken: "0.9.2",
  };

  it("builds desktop windows name", () => {
    expect(packArtifactVersionedName("desktop-windows-nsis", meta)).toBe(
      "freeanima-desktop-windows-x64-0.9.2-dev-setup.exe",
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
  it("defaults channel to dev and reads FREEANIMA_BUILD_VERSION", () => {
    const meta = resolvePackArtifactMeta(undefined, {
      FREEANIMA_BUILD_VERSION: "v1.2.3",
    });
    expect(meta.channel).toBe("dev");
    expect(meta.version).toBe("1.2.3");
    expect(meta.versionToken).toBe("1.2.3");
  });
});
