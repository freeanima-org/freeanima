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
import { waitFor } from "../../helpers/wait.ts";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import {
  resetStoreForTests,
  registerMemoryHandlers,
  l2SessionPath,
  sessionUpdated,
} from "@freeanima/legacy-memory";
import { seedSession } from "@freeanima/legacy-db/test-helpers";

describePgSqlite("memory handlers", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCaseWithConfig(
      "freeanima-handlers-",
      "memory:\n  reflect:\n    enabled: false\n",
    );
    home = ctx.home;
    resetStoreForTests();
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("session:updated creates processed file when reflect disabled", async () => {
    const sid = "20260526_140000_aaaa";
    await seedSession(
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
    registerMemoryHandlers(bus);
    bus.start();
    bus.emit(sessionUpdated, { session_id: sid });

    await waitFor(() => existsSync(l2SessionPath(sid)), { timeoutMs: 3000 });

    expect(existsSync(l2SessionPath(sid))).toBe(true);
    bus.stop();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
