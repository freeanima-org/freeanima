import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";

import { buildSubprocessEnv } from "./subprocess-env.ts";

const KEY = "FA_SUBPROCESS_ENV_TEST";

/** Cross-platform: print one env var (Windows has no `printenv`). Exits 1 when unset. */
function spawnPrintEnv(key: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    [
      "-e",
      `const v=process.env[${JSON.stringify(key)}]; if(v==null) process.exit(1); process.stdout.write(v)`,
    ],
    { encoding: "utf-8", env },
  );
}

describe("buildSubprocessEnv", () => {
  it("Bun 1.4+: omitting spawn env inherits runtime process.env mutations", () => {
    process.env[KEY] = "from-parent";
    try {
      const omitted = spawnPrintEnv(KEY);
      expect(omitted.status).toBe(0);
      expect((omitted.stdout ?? "").trim()).toBe("from-parent");
    } finally {
      delete process.env[KEY];
    }
  });

  it("explicit buildSubprocessEnv snapshots runtime mutations for child", () => {
    process.env[KEY] = "from-parent";
    try {
      const withEnv = spawnPrintEnv(KEY, buildSubprocessEnv());
      expect(withEnv.status).toBe(0);
      expect((withEnv.stdout ?? "").trim()).toBe("from-parent");
    } finally {
      delete process.env[KEY];
    }
  });

  it("merges extra without writing extras into Habitat process.env", () => {
    const before = process.env[KEY];
    delete process.env[KEY];
    try {
      const env = buildSubprocessEnv({ [KEY]: "child-only" });
      expect(process.env[KEY]).toBeUndefined();
      const child = spawnPrintEnv(KEY, env);
      expect(child.status).toBe(0);
      expect((child.stdout ?? "").trim()).toBe("child-only");
    } finally {
      if (before === undefined) delete process.env[KEY];
      else process.env[KEY] = before;
    }
  });
});
