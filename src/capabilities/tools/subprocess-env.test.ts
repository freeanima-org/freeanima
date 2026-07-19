import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";

import { buildSubprocessEnv } from "./subprocess-env.ts";

const KEY = "FA_SUBPROCESS_ENV_TEST";

describe("buildSubprocessEnv", () => {
  it("Bun: omitting spawn env does not see runtime process.env mutations", () => {
    process.env[KEY] = "from-parent";
    try {
      const omitted = spawnSync("printenv", [KEY], { encoding: "utf-8" });
      expect(omitted.status).not.toBe(0);
      expect((omitted.stdout ?? "").trim()).toBe("");
    } finally {
      delete process.env[KEY];
    }
  });

  it("explicit buildSubprocessEnv makes runtime mutations visible to child", () => {
    process.env[KEY] = "from-parent";
    try {
      const withEnv = spawnSync("printenv", [KEY], {
        encoding: "utf-8",
        env: buildSubprocessEnv(),
      });
      expect(withEnv.status).toBe(0);
      expect((withEnv.stdout ?? "").trim()).toBe("from-parent");
    } finally {
      delete process.env[KEY];
    }
  });

  it("merges extra without writing extras into Hub process.env", () => {
    const before = process.env[KEY];
    delete process.env[KEY];
    try {
      const env = buildSubprocessEnv({ [KEY]: "child-only" });
      expect(process.env[KEY]).toBeUndefined();
      const child = spawnSync("printenv", [KEY], { encoding: "utf-8", env });
      expect(child.status).toBe(0);
      expect((child.stdout ?? "").trim()).toBe("child-only");
    } finally {
      if (before === undefined) delete process.env[KEY];
      else process.env[KEY] = before;
    }
  });
});
