import { describe, expect, it } from "bun:test";

import { formatBuildMetaLines, parseComponentBuildMeta } from "./build-meta.ts";

describe("shell-sdk/build-meta", () => {
  it("parseComponentBuildMeta validates shape", () => {
    expect(
      parseComponentBuildMeta({
        component: "web",
        version: "0.8.3",
        channel: "release",
        built_at: "2026-07-08T00:00:00.000Z",
      }),
    ).toMatchObject({ component: "web", version: "0.8.3", channel: "release" });
  });

  it("normalizes legacy prod to release", () => {
    expect(
      parseComponentBuildMeta({
        component: "web",
        version: "0.8.3",
        channel: "prod",
      })?.channel,
    ).toBe("release");
  });

  it("formatBuildMetaLines renders key fields", () => {
    const lines = formatBuildMetaLines({
      component: "service",
      version: "0.8.3",
      channel: "dev",
      git: { commit: "abc", dirty: false },
    });
    expect(lines).toContain("version 0.8.3");
    expect(lines).toContain("channel dev");
    expect(lines).toContain("dirty no");
  });
});
