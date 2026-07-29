import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyTauriShellIdentity,
  TAURI_IDENTITY_OVERLAY_NAME,
} from "./apply-tauri-shell-identity.ts";

function fixtureSrcTauri(): string {
  const dir = mkdtempSync(join(tmpdir(), "fa-tauri-id-"));
  writeFileSync(
    join(dir, "tauri.conf.json"),
    `${JSON.stringify(
      {
        productName: "FreeAnima",
        identifier: "com.freeanima.portal",
        app: {
          windows: [
            {
              label: "main",
              title: "FreeAnima",
              url: "web/index.html",
              width: 1100,
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return dir;
}

describe("applyTauriShellIdentity", () => {
  it("writes .portal.dev overlay for channel=dev", () => {
    const srcTauri = fixtureSrcTauri();
    const applied = applyTauriShellIdentity({
      target: "desktop",
      srcTauri,
      env: {},
    });
    expect(applied.channel).toBe("dev");
    expect(applied.desktop?.appId).toBe("com.freeanima.portal.dev");
    const overlay = JSON.parse(
      readFileSync(join(srcTauri, TAURI_IDENTITY_OVERLAY_NAME), "utf-8"),
    ) as {
      identifier: string;
      productName: string;
      mainBinaryName: string;
      app: { windows: Array<{ title: string; url?: string }> };
    };
    expect(overlay.identifier).toBe("com.freeanima.portal.dev");
    expect(overlay.productName).toBe("FreeAnima Dev");
    expect(overlay.mainBinaryName).toBe("FreeAnima-Dev");
    expect(overlay.app.windows[0]?.title).toBe("FreeAnima Dev");
    expect(overlay.app.windows[0]?.url).toBe("web/index.html");
  });

  it("writes formal identity for canary", () => {
    const srcTauri = fixtureSrcTauri();
    const applied = applyTauriShellIdentity({
      target: "desktop",
      srcTauri,
      env: {
        FREEANIMA_BUILD_CHANNEL: "canary",
        FREEANIMA_BUILD_VERSION: "0.9.3-canary+202607291200",
      },
    });
    expect(applied.channel).toBe("canary");
    expect(applied.version).toBe("0.9.3-canary+202607291200");
    expect(applied.desktop?.appId).toBe("com.freeanima.portal");
    const overlay = JSON.parse(
      readFileSync(join(srcTauri, TAURI_IDENTITY_OVERLAY_NAME), "utf-8"),
    ) as { identifier: string; productName: string; version: string };
    expect(overlay.identifier).toBe("com.freeanima.portal");
    expect(overlay.productName).toBe("FreeAnima");
    expect(overlay.version).toBe("0.9.3-canary+202607291200");
  });

  it("writes mobile applicationId for channel=dev", () => {
    const srcTauri = fixtureSrcTauri();
    const applied = applyTauriShellIdentity({
      target: "mobile",
      srcTauri,
      env: {},
    });
    expect(applied.mobile?.applicationId).toBe("com.freeanima.portal.dev");
    const overlay = JSON.parse(
      readFileSync(join(srcTauri, TAURI_IDENTITY_OVERLAY_NAME), "utf-8"),
    ) as { identifier: string; productName: string; version: string };
    expect(overlay.identifier).toBe("com.freeanima.portal.dev");
    expect(overlay.productName).toBe("FreeAnima Dev");
    expect(typeof overlay.version).toBe("string");
    expect(overlay.version.length).toBeGreaterThan(0);
  });

  it("writes mobile canary versionName + generation-floor versionCode", () => {
    const srcTauri = fixtureSrcTauri();
    const applied = applyTauriShellIdentity({
      target: "mobile",
      srcTauri,
      env: {
        FREEANIMA_BUILD_CHANNEL: "canary",
        FREEANIMA_BUILD_VERSION: "0.9.3-canary+202607291200",
      },
    });
    expect(applied.version).toBe("0.9.3-canary+202607291200");
    expect(applied.androidVersionCode ?? 0).toBeGreaterThan(1_200_000_000);
    const overlay = JSON.parse(
      readFileSync(join(srcTauri, TAURI_IDENTITY_OVERLAY_NAME), "utf-8"),
    ) as {
      version: string;
      bundle: { android: { versionCode: number } };
    };
    expect(overlay.version).toBe("0.9.3-canary+202607291200");
    expect(overlay.bundle.android.versionCode).toBe(applied.androidVersionCode ?? 0);
  });
});
