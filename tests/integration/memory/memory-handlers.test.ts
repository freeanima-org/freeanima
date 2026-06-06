import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePgSqlite } from "../../helpers/sqlite-gate.ts";

import {
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus } from "@freeanima/kernel-eventbus";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { registerMemoryPipeline, sessionUpdated } from "@freeanima/life-memory";
import { PATHS } from "@freeanima/service-config";
import { getTestEngine, seedSession, testConv } from "../../helpers/pg-test.ts";

describePgSqlite("memory handlers", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCaseWithConfig(
      "freeanima-handlers-",
      "memory:\n  reflect:\n    enabled: false\n",
    );
    home = ctx.home;
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("session:updated does not create processed L2 file", async () => {
    const sid = "20260526_140000_aaaa";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: "parlor",
      },
      [
        { role: "user", timestamp: "t1", content: "记一条", pos: 1 },
        { role: "assistant", timestamp: "t2", content: "好的", pos: 2 },
      ],
    );

    const bus = new EventBus(
      createLogger({ sinks: [createNullSink()] }),
      new SqliteEventQueue(join(home, "runtime", "events.db"), { pollMs: 20 }),
    );
    registerMemoryPipeline({
      bus,
      sessionStore: testConv().repos.session,
      semanticStore: getTestEngine().repos.semanticMemory,
    });
    bus.start();
    bus.emit(sessionUpdated, { session_id: sid });

    await new Promise((r) => setTimeout(r, 500));

    expect(existsSync(join(PATHS.processed, `${sid}.jsonl`))).toBe(false);
    bus.stop();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
