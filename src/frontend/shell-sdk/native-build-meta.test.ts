import { describe, expect, it } from "bun:test";

import { nativeBuildMetaDefine, resolveNativeBuildMeta } from "./native-build-meta.ts";
import { readNativeBuildMetaFromDefine } from "./native-build-meta.read.ts";

describe("native-build-meta", () => {
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

  it("nativeBuildMetaDefine produces parseable define payload", () => {
    const meta = resolveNativeBuildMeta({
      shell: "mobile",
      channel: "dev",
      repoRoot: process.cwd(),
      version: "1.0.0",
    });
    const define = nativeBuildMetaDefine(meta);
    expect(define.__NATIVE_BUILD_META__).toBeTruthy();
    const raw = define.__NATIVE_BUILD_META__;
    if (!raw) throw new Error("missing define");
    const parsed = readNativeBuildMetaFromDefine(JSON.parse(raw));
    expect(parsed?.shell).toBe("mobile");
  });
});
