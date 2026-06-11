import { describe, it, expect } from "bun:test";
import { formatDiscordProgressBody } from "./async-task.ts";
import type { AcpAsyncTask } from "./async-task.ts";

function makeTask(notes: string[]): AcpAsyncTask {
  const now = Date.now();
  return {
    taskId: "abc123",
    agentName: "cursor",
    acpSessionId: "acp-1",
    animaSessionId: "sess-1",
    mode: "agent",
    status: "running",
    startedAt: now - 125_000,
    lastProgressAt: now,
    progressNotes: notes,
    lastDeliveredAt: 0,
    timeoutAt: now + 60_000,
  };
}

describe("formatDiscordProgressBody", () => {
  it("shows status header and last two output lines", () => {
    const body = formatDiscordProgressBody(
      makeTask([
        '🔧 read_file({"path":"a.ts"})',
        '🔧 grep({"pattern":"foo"})',
        '🔧 shell({"cmd":"ls"})',
        '🔧 edit({"file":"b.ts"})',
      ]),
    );
    expect(body).toContain("🔄 Cursor running (task: abc123, 2m5s)");
    expect(body).toContain("🔧 shell");
    expect(body).toContain("🔧 edit");
    expect(body).not.toContain("🔧 read_file");
  });

  it("keeps tail when content exceeds Discord limit", () => {
    const longLine = "x".repeat(1800);
    const body = formatDiscordProgressBody(makeTask(["short", longLine, "tail line"]));
    expect(body.length).toBeLessThanOrEqual(2000);
    expect(body).toContain("tail line");
    expect(body).toContain("🔄 Cursor running");
  });
});
