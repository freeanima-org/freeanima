import { describe, expect, test } from "bun:test";

import {
  archiveSession,
  createAgentSession,
  defaultTitle,
  emptySessionsState,
  groupSessionsByRepo,
  listKnownWorkspaceRoots,
  loadAgentSessions,
  patchSessionMeta,
  rememberWorkspace,
  removeSession,
  repoGroupKey,
  visibleSessions,
} from "./agent-sessions.ts";

describe("agent-sessions v3", () => {
  test("一会话一根 / 可无工作区", () => {
    const none = createAgentSession({ workspaceRoot: null });
    expect(none.workspaceRoot).toBeNull();
    expect(none.workspaceKind).toBe("none");
    expect(none.conversationId).toBeNull();
    expect(none.archivedAt).toBeNull();
    expect(none.title).toBe("无工作区");

    const withRoot = createAgentSession({ workspaceRoot: "C:/a/foo" });
    expect(withRoot.workspaceRoot).toBe("C:/a/foo");
    expect(withRoot.workspaceKind).toBe("local");
    expect(defaultTitle(withRoot.workspaceRoot)).toBe("foo");
  });

  test("ssh 会话字段", () => {
    const s = createAgentSession({
      workspaceKind: "ssh",
      workspaceRoot: "/home/u/repo",
      remote: { user: "u", host: "h", remoteWorkspace: "/home/u/repo" },
      outpostInstanceId: "inst1",
    });
    expect(s.workspaceKind).toBe("ssh");
    expect(s.remote?.host).toBe("h");
    expect(repoGroupKey(s)).toContain("ssh:");
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
    expect(repoGroupKey(a)).toBe("freeanima");
    expect(repoGroupKey(b)).toBe("freeanima");
    const groups = groupSessionsByRepo([a, b, createAgentSession({ workspaceRoot: null })]);
    expect(groups.some((g) => g.key === "freeanima" && g.sessions.length === 2)).toBe(true);
    expect(groups.some((g) => g.key === "无工作区")).toBe(true);
  });

  test("archiveSession 软隐藏并切换 active", () => {
    const a = createAgentSession({ title: "A", workspaceRoot: null });
    const b = createAgentSession({ title: "B", workspaceRoot: null });
    const state = {
      sessions: [a, b],
      activeSessionId: a.id,
      knownWorkspaces: [] as string[],
      knownSshTargets: [],
    };
    const next = archiveSession(state, a.id);
    expect(next.sessions.find((s) => s.id === a.id)?.archivedAt).toBeTruthy();
    expect(visibleSessions(next.sessions).map((s) => s.id)).toEqual([b.id]);
    expect(next.activeSessionId).toBe(b.id);
  });

  test("归档最后一个可见会话会补一条空会话", () => {
    const only = createAgentSession({ title: "only", workspaceRoot: null });
    const next = archiveSession(
      { sessions: [only], activeSessionId: only.id, knownWorkspaces: [], knownSshTargets: [] },
      only.id,
    );
    expect(visibleSessions(next.sessions)).toHaveLength(1);
    expect(next.sessions.find((s) => s.id === only.id)?.archivedAt).toBeTruthy();
    expect(next.activeSessionId).not.toBe(only.id);
  });

  test("removeSession 硬删", () => {
    const a = createAgentSession({ title: "A", workspaceRoot: null });
    const b = createAgentSession({ title: "B", workspaceRoot: null });
    const next = removeSession(
      { sessions: [a, b], activeSessionId: a.id, knownWorkspaces: [], knownSshTargets: [] },
      a.id,
    );
    expect(next.sessions.map((s) => s.id)).toEqual([b.id]);
    expect(next.activeSessionId).toBe(b.id);
  });

  test("load 空态", () => {
    const state = loadAgentSessions();
    expect(state.sessions.length).toBeGreaterThanOrEqual(1);
    expect(state.knownSshTargets).toEqual([]);
  });

  test("rememberWorkspace 去重并持久化到 knownWorkspaces", () => {
    const base = emptySessionsState();
    const withRoot = rememberWorkspace(base, "C:/proj/freeanima");
    expect(withRoot.knownWorkspaces).toEqual(["C:/proj/freeanima"]);
    const again = rememberWorkspace(withRoot, "C:/proj/freeanima");
    expect(again.knownWorkspaces).toEqual(["C:/proj/freeanima"]);
    expect(rememberWorkspace(withRoot, "").knownWorkspaces).toEqual(withRoot.knownWorkspaces);
  });

  test("listKnownWorkspaceRoots 合并已知与现存会话并去重", () => {
    const a = createAgentSession({ workspaceRoot: "C:/proj/freeanima" });
    const b = createAgentSession({ workspaceRoot: "D:/wt/freeanima" });
    const state = {
      sessions: [a, b, createAgentSession({ workspaceRoot: null })],
      activeSessionId: a.id,
      knownWorkspaces: ["C:/proj/freeanima", "E:/old/removed"],
      knownSshTargets: [],
    };
    expect(listKnownWorkspaceRoots(state)).toEqual([
      "C:/proj/freeanima",
      "D:/wt/freeanima",
      "E:/old/removed",
    ]);
  });

  test("removeSession 清空会话后仍保留 knownWorkspaces", () => {
    const state = rememberWorkspace(emptySessionsState(), "C:/repo");
    const removed = removeSession(state, state.sessions[0]!.id);
    expect(removed.sessions.length).toBeGreaterThanOrEqual(1);
    expect(removed.knownWorkspaces).toEqual(["C:/repo"]);
  });
});
