import { describe, expect, it } from "bun:test";

import { nativeBuildMetaDefine } from "./native-build-meta.ts";
import { readNativeBuildMetaFromDefine } from "./native-build-meta.read.ts";

describe("native-build-meta", () => {
  it("nativeBuildMetaDefine produces parseable define payload", () => {
    const meta = {
      component: "native" as const,
      shell: "mobile" as const,
      channel: "dev" as const,
      version: "1.0.0",
    };
    const define = nativeBuildMetaDefine(meta);
    expect(define.__NATIVE_BUILD_META__).toBeTruthy();
    const raw = define.__NATIVE_BUILD_META__;
    if (!raw) throw new Error("missing define");
    const parsed = readNativeBuildMetaFromDefine(JSON.parse(raw));
    expect(parsed?.shell).toBe("mobile");
  });
});
