import { describe, expect, test } from "bun:test";

import {
  archiveSession,
  createAgentSession,
  defaultTitle,
  groupSessionsByRepo,
  loadAgentSessions,
  patchSessionMeta,
  removeSession,
  repoGroupKey,
  visibleSessions,
} from "./agent-sessions.ts";

describe("agent-sessions v2", () => {
  test("一会话一根 / 可无工作区", () => {
    const none = createAgentSession({ workspaceRoot: null });
    expect(none.workspaceRoot).toBeNull();
    expect(none.conversationId).toBeNull();
    expect(none.archivedAt).toBeNull();
    expect(none.title).toBe("无工作区");

    const withRoot = createAgentSession({ workspaceRoot: "C:/a/foo" });
    expect(withRoot.workspaceRoot).toBe("C:/a/foo");
    expect(defaultTitle(withRoot.workspaceRoot)).toBe("foo");
  });

  test("patchSessionMeta 不改 workspaceRoot", () => {
    const s = createAgentSession({ workspaceRoot: "C:/repo" });
    const next = patchSessionMeta(s, { conversationId: "c1", title: "任务 A" });
    expect(next.workspaceRoot).toBe("C:/repo");
    expect(next.conversationId).toBe("c1");
    expect(next.title).toBe("任务 A");
  });

  test("按仓库分组", () => {
    const a = createAgentSession({ workspaceRoot: "C:/proj/freeanima", title: "t1" });
    const b = createAgentSession({ workspaceRoot: "D:/wt/freeanima", title: "t2" });
    // 同 basename 同组
    expect(repoGroupKey(a.workspaceRoot)).toBe("freeanima");
    expect(repoGroupKey(b.workspaceRoot)).toBe("freeanima");
    const groups = groupSessionsByRepo([a, b, createAgentSession({ workspaceRoot: null })]);
    expect(groups.some((g) => g.key === "freeanima" && g.sessions.length === 2)).toBe(true);
    expect(groups.some((g) => g.key === "无工作区")).toBe(true);
  });

  test("archiveSession 软隐藏并切换 active", () => {
    const a = createAgentSession({ title: "A", workspaceRoot: null });
    const b = createAgentSession({ title: "B", workspaceRoot: null });
    const state = { sessions: [a, b], activeSessionId: a.id };
    const next = archiveSession(state, a.id);
    expect(next.sessions.find((s) => s.id === a.id)?.archivedAt).toBeTruthy();
    expect(visibleSessions(next.sessions).map((s) => s.id)).toEqual([b.id]);
    expect(next.activeSessionId).toBe(b.id);
  });

  test("归档最后一个可见会话会补一条空会话", () => {
    const only = createAgentSession({ title: "only", workspaceRoot: null });
    const next = archiveSession({ sessions: [only], activeSessionId: only.id }, only.id);
    expect(visibleSessions(next.sessions)).toHaveLength(1);
    expect(next.sessions.find((s) => s.id === only.id)?.archivedAt).toBeTruthy();
    expect(next.activeSessionId).not.toBe(only.id);
  });

  test("removeSession 硬删", () => {
    const a = createAgentSession({ title: "A", workspaceRoot: null });
    const b = createAgentSession({ title: "B", workspaceRoot: null });
    const next = removeSession({ sessions: [a, b], activeSessionId: a.id }, a.id);
    expect(next.sessions.map((s) => s.id)).toEqual([b.id]);
    expect(next.activeSessionId).toBe(b.id);
  });

  test("load 空态", () => {
    // node 测试无 localStorage 时 empty
    const state = loadAgentSessions();
    expect(state.sessions.length).toBeGreaterThanOrEqual(1);
  });
});
