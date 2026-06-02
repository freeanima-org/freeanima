import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { waitFor } from "../../../../tests/helpers/wait.ts";
import { EventBus } from "@freeanima/legacy-kernel";
import { seedLegacyPythonStyleEvent } from "@freeanima/legacy-kernel/test-helpers";

describe("event-bus schema", () => {
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

    seedLegacyPythonStyleEvent(dbPath, "test:ping", { n: 1 });

    const bus = new EventBus(dbPath);
    const seen: number[] = [];
    bus.on("test:ping", (p) => {
      seen.push(Number(p.n));
    });
    bus.start(10);
    await waitFor(() => seen.length === 1, { timeoutMs: 400 });
    bus.stop();
    expect(seen).toEqual([1]);
  });
});
