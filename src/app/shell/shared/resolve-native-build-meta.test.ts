import { describe, expect, it } from "bun:test";

import { resolveNativeBuildMeta } from "./resolve-native-build-meta.ts";

describe("resolve-native-build-meta", () => {
  it("resolveNativeBuildMeta sets shell and built_at for prod", () => {
    const meta = resolveNativeBuildMeta({
      shell: "desktop",
      channel: "prod",
      repoRoot: process.cwd(),
      version: "1.0.0",
    });
    expect(meta.component).toBe("native");
    expect(meta.shell).toBe("desktop");
    expect(meta.built_at).toBeTruthy();
  });
});
