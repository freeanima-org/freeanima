import { describe, expect, it } from "bun:test";

import { matchNsisSetupForProduct } from "./build-tauri-desktop-windows.ts";

describe("matchNsisSetupForProduct", () => {
  const mixed = [
    "FreeAnima_0.9.2_x64-setup.exe",
    "FreeAnima Local_0.9.2_x64-setup.exe",
    "readme.txt",
  ];

  it("picks FreeAnima Local and ignores FreeAnima_", () => {
    const r = matchNsisSetupForProduct(mixed, "FreeAnima Local");
    expect(r).toEqual({ ok: true, name: "FreeAnima Local_0.9.2_x64-setup.exe" });
  });

  it("picks FreeAnima_ without matching FreeAnima Local_", () => {
    const r = matchNsisSetupForProduct(mixed, "FreeAnima");
    expect(r).toEqual({ ok: true, name: "FreeAnima_0.9.2_x64-setup.exe" });
  });

  it("accepts dash-normalized Local name", () => {
    const r = matchNsisSetupForProduct(
      ["FreeAnima-Local_0.9.2_x64-setup.exe", "FreeAnima_0.9.2_x64-setup.exe"],
      "FreeAnima Local",
    );
    expect(r).toEqual({ ok: true, name: "FreeAnima-Local_0.9.2_x64-setup.exe" });
  });

  it("fails when zero matches", () => {
    const r = matchNsisSetupForProduct(["other-setup.exe"], "FreeAnima Local");
    expect(r.ok).toBe(false);
  });

  it("fails when multiple matches", () => {
    const r = matchNsisSetupForProduct(
      ["FreeAnima Local_0.9.2_x64-setup.exe", "FreeAnima-Local_0.9.3_x64-setup.exe"],
      "FreeAnima Local",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.matches).toHaveLength(2);
  });
});
