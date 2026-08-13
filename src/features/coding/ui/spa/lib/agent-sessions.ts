/**
 * Coding Agent Window：多 Agent 会话。
 * 硬约束：一对话一根工作区（可 null）；创建后不可变（为 worktree 留口）。
 */

export type CodingAgentSession = {
  id: string;
  title: string;
  /** 创建时锁定；null = 无工作区；之后不可改 */
  workspaceRoot: string | null;
  /** Habitat conversation；PR2 写入后复用 */
  conversationId: string | null;
  /** 软归档时间戳；null = 仍在主列表 */
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AgentSessionsState = {
  sessions: CodingAgentSession[];
  activeSessionId: string | null;
};

const STORAGE_KEY = "freeanima:coding:agent-sessions:v2";
const LEGACY_STORAGE_KEY = "freeanima:coding:agent-sessions:v1";

export function newSessionId(): string {
  return `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRoot(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").trim();
}

export function basename(path: string): string {
  const posix = normalizeRoot(path);
  const parts = posix.split("/").filter(Boolean);
  return parts[parts.length - 1] || posix || "workspace";
}

export function defaultTitle(workspaceRoot: string | null): string {
  if (!workspaceRoot) return "无工作区";
  return basename(workspaceRoot);
}

/** 仓库分组键：无工作区用固定标签；有根用 basename（同仓多会话同组） */
export function repoGroupKey(workspaceRoot: string | null): string {
  return workspaceRoot ? basename(workspaceRoot) : "无工作区";
}

export function createAgentSession(partial?: {
  title?: string;
  workspaceRoot?: string | null;
  conversationId?: string | null;
}): CodingAgentSession {
  const now = Date.now();
  const rootRaw = partial?.workspaceRoot;
  const workspaceRoot = rootRaw == null || rootRaw === "" ? null : normalizeRoot(rootRaw) || null;
  return {
    id: newSessionId(),
    title: partial?.title?.trim() || defaultTitle(workspaceRoot),
    workspaceRoot,
    conversationId: partial?.conversationId?.trim() || null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function emptySessionsState(): AgentSessionsState {
  const first = createAgentSession({ title: "无工作区", workspaceRoot: null });
  return { sessions: [first], activeSessionId: first.id };
}

export function loadAgentSessions(): AgentSessionsState {
  if (typeof localStorage === "undefined") return emptySessionsState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AgentSessionsState;
      return normalizeState(parsed);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = migrateV1(JSON.parse(legacy));
      saveAgentSessions(migrated);
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return migrated;
    }
    return emptySessionsState();
  } catch {
    return emptySessionsState();
  }
}

export function saveAgentSessions(state: AgentSessionsState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

/** v1：workspaceRoots[] + activeRoot → 单根 */
function migrateV1(raw: unknown): AgentSessionsState {
  if (!raw || typeof raw !== "object") return emptySessionsState();
  const r = raw as {
    sessions?: unknown[];
    activeSessionId?: string | null;
  };
  if (!Array.isArray(r.sessions) || r.sessions.length === 0) return emptySessionsState();
  const sessions = r.sessions.map((row) => sanitizeSession(migrateSessionRow(row)));
  const activeSessionId =
    sessions.find((s) => s.id === r.activeSessionId)?.id ??
    sessions.at(0)?.id ??
    emptySessionsState().activeSessionId;
  return { sessions, activeSessionId };
}

function migrateSessionRow(row: unknown): Partial<CodingAgentSession> & Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const s = row as Record<string, unknown>;
  if (typeof s.workspaceRoot === "string" || s.workspaceRoot === null) {
    return s;
  }
  const roots = Array.isArray(s.workspaceRoots)
    ? (s.workspaceRoots as unknown[])
        .map((x) => String(x))
        .map(normalizeRoot)
        .filter(Boolean)
    : [];
  const active = typeof s.activeRoot === "string" ? normalizeRoot(s.activeRoot) : null;
  const workspaceRoot = (active && roots.includes(active) ? active : null) ?? roots[0] ?? null;
  return { ...s, workspaceRoot };
}

function normalizeState(parsed: AgentSessionsState): AgentSessionsState {
  if (!Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
    return emptySessionsState();
  }
  const sessions = parsed.sessions.map(sanitizeSession);
  const visible = visibleSessions(sessions);
  if (visible.length === 0) {
    const fresh = createAgentSession({ title: "无工作区", workspaceRoot: null });
    return { sessions: [...sessions, fresh], activeSessionId: fresh.id };
  }
  const activeSessionId =
    visible.find((s) => s.id === parsed.activeSessionId)?.id ?? visible.at(0)?.id ?? null;
  if (!activeSessionId) return emptySessionsState();
  return { sessions, activeSessionId };
}

function sanitizeSession(
  s: Partial<CodingAgentSession> & Record<string, unknown>,
): CodingAgentSession {
  let workspaceRoot: string | null = null;
  if (typeof s.workspaceRoot === "string" && s.workspaceRoot.trim()) {
    workspaceRoot = normalizeRoot(s.workspaceRoot);
  } else if (s.workspaceRoot === null) {
    workspaceRoot = null;
  }
  const archivedAt =
    typeof s.archivedAt === "number" && Number.isFinite(s.archivedAt) && s.archivedAt > 0
      ? s.archivedAt
      : null;
  return {
    id: s.id || newSessionId(),
    title: s.title || defaultTitle(workspaceRoot),
    workspaceRoot,
    conversationId:
      typeof s.conversationId === "string" && s.conversationId.trim()
        ? s.conversationId.trim()
        : null,
    archivedAt,
    createdAt: Number(s.createdAt) || Date.now(),
    updatedAt: Number(s.updatedAt) || Date.now(),
  };
}

export function getActiveSession(state: AgentSessionsState): CodingAgentSession | null {
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}

export function visibleSessions(sessions: CodingAgentSession[]): CodingAgentSession[] {
  return sessions.filter((s) => s.archivedAt == null);
}

export function upsertSession(
  state: AgentSessionsState,
  session: CodingAgentSession,
): AgentSessionsState {
  const idx = state.sessions.findIndex((s) => s.id === session.id);
  const sessions =
    idx >= 0
      ? state.sessions.map((s, i) => (i === idx ? session : s))
      : [...state.sessions, session];
  return { ...state, sessions };
}

export function removeSession(state: AgentSessionsState, id: string): AgentSessionsState {
  const sessions = state.sessions.filter((s) => s.id !== id);
  const visible = visibleSessions(sessions);
  if (visible.length === 0) {
    const fresh = createAgentSession({ title: "无工作区", workspaceRoot: null });
    return { sessions: [...sessions, fresh], activeSessionId: fresh.id };
  }
  const activeSessionId =
    state.activeSessionId === id ? (visible.at(0)?.id ?? null) : state.activeSessionId;
  return { sessions, activeSessionId };
}

/** 软归档：离开主列表，数据仍留在 localStorage。 */
export function archiveSession(state: AgentSessionsState, id: string): AgentSessionsState {
  const now = Date.now();
  const sessions = state.sessions.map((s) =>
    s.id === id ? { ...s, archivedAt: now, updatedAt: now } : s,
  );
  const visible = visibleSessions(sessions);
  if (visible.length === 0) {
    const fresh = createAgentSession({ title: "无工作区", workspaceRoot: null });
    return { sessions: [...sessions, fresh], activeSessionId: fresh.id };
  }
  const activeSessionId =
    state.activeSessionId === id ? (visible.at(0)?.id ?? null) : state.activeSessionId;
  return { sessions, activeSessionId };
}

/** 仅允许写 conversationId / title / updatedAt；workspaceRoot 创建后不可变 */
export function patchSessionMeta(
  session: CodingAgentSession,
  patch: { conversationId?: string | null; title?: string },
): CodingAgentSession {
  return {
    ...session,
    ...(patch.conversationId !== undefined ? { conversationId: patch.conversationId } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() || session.title } : {}),
    updatedAt: Date.now(),
  };
}

export type RepoGroup = {
  key: string;
  workspaceRoot: string | null;
  sessions: CodingAgentSession[];
};

export function groupSessionsByRepo(sessions: CodingAgentSession[]): RepoGroup[] {
  const map = new Map<string, RepoGroup>();
  for (const s of sessions) {
    const key = repoGroupKey(s.workspaceRoot);
    let g = map.get(key);
    if (!g) {
      g = { key, workspaceRoot: s.workspaceRoot, sessions: [] };
      map.set(key, g);
    }
    g.sessions.push(s);
  }
  return [...map.values()].toSorted((a, b) => {
    if (a.workspaceRoot == null) return 1;
    if (b.workspaceRoot == null) return -1;
    return a.key.localeCompare(b.key);
  });
}
