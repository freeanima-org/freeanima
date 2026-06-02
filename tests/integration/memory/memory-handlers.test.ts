import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCaseWithConfig } from "../../helpers/integration-case.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { waitFor } from "../../helpers/wait.ts";
import { EventBus } from "@freeanima/legacy-kernel";
import { resetStoreForTests, registerMemoryHandlers, l2SessionPath } from "@freeanima/legacy-memory";
import { seedSession } from "@freeanima/legacy-db/test-helpers";

describePg("memory handlers", () => {
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
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
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

    const bus = new EventBus(join(home, "runtime", "events.db"));
    registerMemoryHandlers(bus);
    bus.start(20);
    bus.emit("session:updated", { session_id: sid });

    await waitFor(() => existsSync(l2SessionPath(sid)), { timeoutMs: 3000 });

    expect(existsSync(l2SessionPath(sid))).toBe(true);
    bus.stop();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
