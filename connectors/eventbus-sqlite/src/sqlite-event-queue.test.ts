import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus, createEventTopic } from "@freeanima/kernel-eventbus";
import { SqliteEventQueue } from "./sqlite-event-queue.js";
import { seedLegacyPythonStyleEvent } from "./test-helpers.js";

const testPing = createEventTopic<{ n: number }>("test:ping");

async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("SqliteEventQueue", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-bus-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("reads Python-style events table (data column)", async () => {
    mkdirSync(join(home, "runtime"), { recursive: true });
    const dbPath = join(home, "runtime", "events.db");

    seedLegacyPythonStyleEvent(dbPath, testPing.qualifiedId, { n: 1 });

    const bus = new EventBus(
      createLogger({ sinks: [createNullSink()] }),
      new SqliteEventQueue(dbPath, { pollMs: 10 }),
    );
    const seen: number[] = [];
    bus.on(testPing, (p) => {
      seen.push(p.n);
    });
    bus.start();
    await waitFor(() => seen.length === 1);
    bus.stop();
    expect(seen).toEqual([1]);
  });
});
