import { describe, expect, it } from "bun:test";

import { matchNsisSetupForProduct } from "./build-tauri-desktop-windows.ts";

describe("matchNsisSetupForProduct", () => {
  const mixed = [
    "FreeAnima_0.9.2_x64-setup.exe",
    "FreeAnima Dev_0.9.2_x64-setup.exe",
    "readme.txt",
  ];

  it("picks FreeAnima Dev and ignores FreeAnima_", () => {
    const r = matchNsisSetupForProduct(mixed, "FreeAnima Dev");
    expect(r).toEqual({ ok: true, name: "FreeAnima Dev_0.9.2_x64-setup.exe" });
  });

  it("picks FreeAnima_ without matching FreeAnima Dev_", () => {
    const r = matchNsisSetupForProduct(mixed, "FreeAnima");
    expect(r).toEqual({ ok: true, name: "FreeAnima_0.9.2_x64-setup.exe" });
  });

  it("accepts dash-normalized Dev name", () => {
    const r = matchNsisSetupForProduct(
      ["FreeAnima-Dev_0.9.2_x64-setup.exe", "FreeAnima_0.9.2_x64-setup.exe"],
      "FreeAnima Dev",
    );
    expect(r).toEqual({ ok: true, name: "FreeAnima-Dev_0.9.2_x64-setup.exe" });
  });

  it("fails when zero matches", () => {
    const r = matchNsisSetupForProduct(["other-setup.exe"], "FreeAnima Dev");
    expect(r.ok).toBe(false);
  });

  it("fails when multiple matches", () => {
    const r = matchNsisSetupForProduct(
      ["FreeAnima Dev_0.9.2_x64-setup.exe", "FreeAnima-Dev_0.9.3_x64-setup.exe"],
      "FreeAnima Dev",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.matches).toHaveLength(2);
  });
});
