import { describe, expect, it } from "bun:test";

import { readNativeBuildMetaFromDefine } from "./native-build-meta.read.ts";

describe("native-build-meta.read", () => {
  it("readNativeBuildMetaFromDefine accepts baked native meta", () => {
    const meta = readNativeBuildMetaFromDefine({
      component: "native",
      shell: "mobile",
      version: "1.0.0",
      channel: "local",
    });
    expect(meta?.shell).toBe("mobile");
  });

  it("readNativeBuildMetaFromDefine rejects non-native component", () => {
    expect(
      readNativeBuildMetaFromDefine({
        component: "web",
        version: "1.0.0",
        channel: "local",
      }),
    ).toBeUndefined();
  });
});
