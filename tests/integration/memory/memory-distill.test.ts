import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../helpers/integration-case.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  resetStoreForTests,
  distillFromPg,
  l2SessionPath,
  processedDir,
} from "@freeanima/legacy-memory";
import { seedSession } from "@freeanima/legacy-db/test-helpers";

describePg("memory distill", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-mem-");
    home = ctx.home;
    resetStoreForTests();
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("distills L1 to L2 format", async () => {
    const sid = "20260526_120000_abcd";
    await seedSession(
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T12:00:00+08:00",
        platform: "web",
        title: "测试",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T12:00:00+08:00",
          content: "你好",
          pos: 1,
        },
        {
          role: "assistant",
          timestamp: "2026-05-26T12:00:01+08:00",
          content: "你好呀",
          pos: 2,
        },
      ],
    );

    const out = await distillFromPg(sid, { overwrite: true });
    expect(out).not.toBeNull();
    const l2Path = l2SessionPath(sid);
    expect(existsSync(l2Path)).toBe(true);
    const l2Lines = readFileSync(l2Path, "utf-8").trim().split("\n");
    expect(l2Lines.length).toBe(3);
    const meta = JSON.parse(l2Lines[0]!) as Record<string, unknown>;
    expect(meta.type).toBe("meta");
    expect(meta.session_id).toBe(sid);
    const msg = JSON.parse(l2Lines[1]!) as Record<string, unknown>;
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("你好");
  });

  it("if_newer skips when L2 is newer", async () => {
    const sid = "20260526_130000_ef01";
    mkdirSync(processedDir(), { recursive: true });
    await seedSession(
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T10:00:00+08:00",
        platform: "parlor",
      },
      [{ role: "user", timestamp: "2026-05-26T10:00:00+08:00", content: "a", pos: 1 }],
    );
    const l2 = l2SessionPath(sid);
    writeFileSync(
      l2,
      `${JSON.stringify({ type: "meta", session_id: sid })}\n${JSON.stringify({ role: "user", t: "t1", content: "a" })}\n`,
      "utf-8",
    );
    const now = Date.now() / 1000;
    utimesSync(l2, now + 60, now + 60);

    const result = await distillFromPg(sid, { ifNewer: true });
    expect(result).toBeNull();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
