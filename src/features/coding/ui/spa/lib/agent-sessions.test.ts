import { describe, expect, test } from "bun:test";

import {
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
} from "./agent-sessions.ts";

describe("agent-sessions v2", () => {
  test("一会话一根 / 可无工作区", () => {
    const none = createAgentSession({ workspaceRoot: null });
    expect(none.workspaceRoot).toBeNull();
    expect(none.conversationId).toBeNull();
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

  test("load 空态", () => {
    // node 测试无 localStorage 时 empty
    const state = loadAgentSessions();
    expect(state.sessions.length).toBeGreaterThanOrEqual(1);
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
