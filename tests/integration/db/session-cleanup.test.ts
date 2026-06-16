import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { sessions } from "@freeanima/core/db/schema";
import { getDb } from "@freeanima/platform/connectors/db-pg";
import { cleanupStaleSessions, STALE_SESSION_MIN_AGE_MS } from "@freeanima/runtime/session";
import { getTestEngine } from "../../helpers/pg-test.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

const STALE_UPDATED_AT = "2020-01-01T00:00:00+08:00";

async function seedMeta(
  session: ReturnType<typeof getTestEngine>["repos"]["session"],
  sessionId: string,
  opts?: { debug?: boolean },
): Promise<void> {
  await session.upsertSessionMeta(sessionId, {
    role: "session_meta",
    model: "test-model",
    tools: [],
    functions: [],
    timestamp: new Date().toISOString(),
    platform: "parlor",
    debug: opts?.debug ?? false,
  });
}

async function backdateSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.update(sessions).set({ updatedAt: STALE_UPDATED_AT }).where(eq(sessions.id, sessionId));
}

describePg("session cleanup (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-session-cleanup-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("deletes stale zero-message, single-message, and multi-user-no-assistant sessions", async () => {
    const engine = getTestEngine();
    const session = engine.repos.session;

    const emptyId = "cleanup_empty";
    const singleUserId = "cleanup_single_user";
    const singleAssistantId = "cleanup_single_assistant";
    const multiUserId = "cleanup_multi_user";
    const healthyId = "cleanup_healthy";

    await seedMeta(session, emptyId);
    await backdateSession(emptyId);

    await seedMeta(session, singleUserId);
    await session.appendMessage(singleUserId, {
      role: "user",
      content: "orphan user",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleUserId);

    await seedMeta(session, singleAssistantId);
    await session.appendMessage(singleAssistantId, {
      role: "assistant",
      content: "handoff summary",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleAssistantId);

    await seedMeta(session, multiUserId);
    await session.appendMessage(multiUserId, {
      role: "user",
      content: "u1",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await session.appendMessage(multiUserId, {
      role: "user",
      content: "u2",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(multiUserId);

    await seedMeta(session, healthyId);
    await session.appendMessage(healthyId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await session.appendMessage(healthyId, {
      role: "assistant",
      content: "hi",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(healthyId);

    const result = await cleanupStaleSessions(engine.repos);

    expect(result.deleted).toBe(4);
    expect(result.ids.toSorted()).toEqual(
      [emptyId, singleUserId, singleAssistantId, multiUserId].toSorted(),
    );
    expect(await session.sessionExists(healthyId)).toBe(true);
    expect(await session.sessionExists(emptyId)).toBe(false);
  });

  it("skips recent zero-message sessions within 24h window", async () => {
    const engine = getTestEngine();
    const session = engine.repos.session;
    const recentEmptyId = "cleanup_recent_empty";

    await seedMeta(session, recentEmptyId);

    const result = await cleanupStaleSessions(engine.repos);

    expect(result.deleted).toBe(0);
    expect(await session.sessionExists(recentEmptyId)).toBe(true);
  });

  it("skips debug sessions even when stale", async () => {
    const engine = getTestEngine();
    const session = engine.repos.session;
    const debugId = "cleanup_debug_empty";

    await seedMeta(session, debugId, { debug: true });
    await backdateSession(debugId);

    const result = await cleanupStaleSessions(engine.repos);

    expect(result.deleted).toBe(0);
    expect(await session.sessionExists(debugId)).toBe(true);
  });

  it("listStaleSessionIdsForCleanup respects custom olderThan", async () => {
    const engine = getTestEngine();
    const session = engine.repos.session;
    const sessionId = "cleanup_custom_threshold";

    await seedMeta(session, sessionId);

    const withinWindow = await session.listStaleSessionIdsForCleanup({
      olderThan: new Date(Date.now() - STALE_SESSION_MIN_AGE_MS),
    });
    expect(withinWindow).not.toContain(sessionId);

    const pastNow = await session.listStaleSessionIdsForCleanup({
      olderThan: new Date(Date.now() + 60_000),
    });
    expect(pastNow).toContain(sessionId);
  });
});
