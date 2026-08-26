import { asRecord } from "@freeanima/shared/util";
import type { SshRemoteTarget } from "@freeanima/shared/coding/ssh-remote";

/**
 * Coding Agent Window：多 Agent 会话。
 * 硬约束：一对话一根工作区（可 null）；创建后不可变（为 worktree 留口）。
 */

export type CodingWorkspaceKind = "local" | "ssh" | "none";

export type CodingAgentSession = {
  id: string;
  title: string;
  /** 创建时锁定；null = 无工作区；之后不可改。SSH 时为远端绝对路径 */
  workspaceRoot: string | null;
  workspaceKind: CodingWorkspaceKind;
  /** kind===ssh 时必填 */
  remote?: SshRemoteTarget;
  /** SSH / 显式绑定时的 outpost instance */
  outpostInstanceId?: string | null;
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
  /** 已知工作区（曾选过的本地路径，去重） */
  knownWorkspaces: string[];
  /** 已知 SSH 目标（去重） */
  knownSshTargets: SshRemoteTarget[];
};

const STORAGE_KEY = "freeanima:coding:agent-sessions:v3";
const LEGACY_V2_KEY = "freeanima:coding:agent-sessions:v2";
const LEGACY_V1_KEY = "freeanima:coding:agent-sessions:v1";

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

export function defaultTitle(workspaceRoot: string | null, kind?: CodingWorkspaceKind): string {
  if (kind === "ssh" && workspaceRoot) return `ssh:${basename(workspaceRoot)}`;
  if (!workspaceRoot) return "无工作区";
  return basename(workspaceRoot);
}

/** 仓库分组键 */
export function repoGroupKey(
  session: Pick<CodingAgentSession, "workspaceRoot" | "workspaceKind" | "remote">,
): string {
  if (session.workspaceKind === "ssh" && session.remote) {
    return `ssh:${session.remote.user}@${session.remote.host}:${basename(session.remote.remoteWorkspace)}`;
  }
  return session.workspaceRoot ? basename(session.workspaceRoot) : "无工作区";
}

export function createAgentSession(partial?: {
  title?: string;
  workspaceRoot?: string | null;
  workspaceKind?: CodingWorkspaceKind;
  remote?: SshRemoteTarget;
  outpostInstanceId?: string | null;
  conversationId?: string | null;
}): CodingAgentSession {
  const now = Date.now();
  const kind =
    partial?.workspaceKind ?? (partial?.remote ? "ssh" : partial?.workspaceRoot ? "local" : "none");
  const rootRaw = partial?.workspaceRoot ?? partial?.remote?.remoteWorkspace ?? null;
  const workspaceRoot =
    rootRaw == null || rootRaw === ""
      ? null
      : kind === "ssh"
        ? rootRaw.trim()
        : normalizeRoot(rootRaw) || null;
  return {
    id: newSessionId(),
    title: partial?.title?.trim() || defaultTitle(workspaceRoot, kind),
    workspaceRoot,
    workspaceKind: kind,
    ...(partial?.remote ? { remote: partial.remote } : {}),
    outpostInstanceId: partial?.outpostInstanceId?.trim() || null,
    conversationId: partial?.conversationId?.trim() || null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function emptySessionsState(): AgentSessionsState {
  const first = createAgentSession({
    title: "无工作区",
    workspaceRoot: null,
    workspaceKind: "none",
  });
  return {
    sessions: [first],
    activeSessionId: first.id,
    knownWorkspaces: [],
    knownSshTargets: [],
  };
}

export function loadAgentSessions(): AgentSessionsState {
  if (typeof localStorage === "undefined") return emptySessionsState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse 边界
      return normalizeState(JSON.parse(raw) as AgentSessionsState);
    }
    const v2 = localStorage.getItem(LEGACY_V2_KEY);
    if (v2) {
      const migrated = migrateV2(JSON.parse(v2));
      saveAgentSessions(migrated);
      try {
        localStorage.removeItem(LEGACY_V2_KEY);
      } catch {
        /* ignore */
      }
      return migrated;
    }
    const legacy = localStorage.getItem(LEGACY_V1_KEY);
    if (legacy) {
      const migrated = migrateV1(JSON.parse(legacy));
      saveAgentSessions(migrated);
      try {
        localStorage.removeItem(LEGACY_V1_KEY);
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

function migrateV2(raw: unknown): AgentSessionsState {
  if (!raw || typeof raw !== "object") return emptySessionsState();
  const r = asRecord(raw) ?? {};
  const sessionsRaw = Array.isArray(r.sessions) ? r.sessions : [];
  if (sessionsRaw.length === 0) return emptySessionsState();
  const sessions = sessionsRaw.map((row) => sanitizeSession(asRecord(row) ?? {}));
  const knownWorkspaces = sanitizeKnownWorkspaces(r.knownWorkspaces, sessions);
  const activeSessionId =
    sessions.find((s) => s.id === r.activeSessionId)?.id ?? sessions.at(0)?.id ?? null;
  return {
    sessions,
    activeSessionId,
    knownWorkspaces,
    knownSshTargets: sanitizeKnownSshTargets(r.knownSshTargets),
  };
}

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
  return {
    sessions,
    activeSessionId,
    knownWorkspaces: collectWorkspaceRoots(sessions),
    knownSshTargets: [],
  };
}

function migrateSessionRow(row: unknown): Partial<CodingAgentSession> & Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const s = asRecord(row) ?? {};
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
  const sessions = parsed.sessions.map((s) => sanitizeSession(s));
  const visible = visibleSessions(sessions);
  const knownWorkspaces = sanitizeKnownWorkspaces(parsed.knownWorkspaces, sessions);
  const knownSshTargets = sanitizeKnownSshTargets(parsed.knownSshTargets);
  if (visible.length === 0) {
    const fresh = createAgentSession({
      title: "无工作区",
      workspaceRoot: null,
      workspaceKind: "none",
    });
    return {
      sessions: [...sessions, fresh],
      activeSessionId: fresh.id,
      knownWorkspaces,
      knownSshTargets,
    };
  }
  const activeSessionId =
    visible.find((s) => s.id === parsed.activeSessionId)?.id ?? visible.at(0)?.id ?? null;
  if (!activeSessionId) return emptySessionsState();
  return { sessions, activeSessionId, knownWorkspaces, knownSshTargets };
}

function sanitizeRemote(raw: unknown): SshRemoteTarget | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const user = typeof o.user === "string" ? o.user.trim() : "";
  const host = typeof o.host === "string" ? o.host.trim() : "";
  const remoteWorkspace = typeof o.remoteWorkspace === "string" ? o.remoteWorkspace.trim() : "";
  if (!user || !host || !remoteWorkspace) return undefined;
  const port = typeof o.port === "number" && o.port > 0 ? o.port : undefined;
  const identityFile =
    typeof o.identityFile === "string" && o.identityFile.trim() ? o.identityFile.trim() : undefined;
  return {
    user,
    host,
    remoteWorkspace,
    ...(port != null ? { port } : {}),
    ...(identityFile ? { identityFile } : {}),
  };
}

function sanitizeSession(
  s: Partial<CodingAgentSession> & Record<string, unknown>,
): CodingAgentSession {
  const remote = sanitizeRemote(s.remote);
  let workspaceKind: CodingWorkspaceKind =
    s.workspaceKind === "ssh" || s.workspaceKind === "local" || s.workspaceKind === "none"
      ? s.workspaceKind
      : remote
        ? "ssh"
        : typeof s.workspaceRoot === "string" && s.workspaceRoot.trim()
          ? "local"
          : "none";
  let workspaceRoot: string | null = null;
  if (typeof s.workspaceRoot === "string" && s.workspaceRoot.trim()) {
    workspaceRoot =
      workspaceKind === "ssh" ? s.workspaceRoot.trim() : normalizeRoot(s.workspaceRoot);
  } else if (remote) {
    workspaceRoot = remote.remoteWorkspace;
    workspaceKind = "ssh";
  } else if (s.workspaceRoot === null) {
    workspaceRoot = null;
  }
  if (workspaceKind === "ssh" && !remote) {
    workspaceKind = workspaceRoot ? "local" : "none";
  }
  const archivedAt =
    typeof s.archivedAt === "number" && Number.isFinite(s.archivedAt) && s.archivedAt > 0
      ? s.archivedAt
      : null;
  return {
    id: s.id || newSessionId(),
    title: s.title || defaultTitle(workspaceRoot, workspaceKind),
    workspaceRoot,
    workspaceKind,
    ...(remote && workspaceKind === "ssh" ? { remote } : {}),
    outpostInstanceId:
      typeof s.outpostInstanceId === "string" && s.outpostInstanceId.trim()
        ? s.outpostInstanceId.trim()
        : null,
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
    const fresh = createAgentSession({
      title: "无工作区",
      workspaceRoot: null,
      workspaceKind: "none",
    });
    return {
      sessions: [...sessions, fresh],
      activeSessionId: fresh.id,
      knownWorkspaces: state.knownWorkspaces,
      knownSshTargets: state.knownSshTargets,
    };
  }
  const activeSessionId =
    state.activeSessionId === id ? (visible.at(0)?.id ?? null) : state.activeSessionId;
  return {
    sessions,
    activeSessionId,
    knownWorkspaces: state.knownWorkspaces,
    knownSshTargets: state.knownSshTargets,
  };
}

export function archiveSession(state: AgentSessionsState, id: string): AgentSessionsState {
  const now = Date.now();
  const sessions = state.sessions.map((s) =>
    s.id === id ? { ...s, archivedAt: now, updatedAt: now } : s,
  );
  const visible = visibleSessions(sessions);
  if (visible.length === 0) {
    const fresh = createAgentSession({
      title: "无工作区",
      workspaceRoot: null,
      workspaceKind: "none",
    });
    return {
      sessions: [...sessions, fresh],
      activeSessionId: fresh.id,
      knownWorkspaces: state.knownWorkspaces,
      knownSshTargets: state.knownSshTargets,
    };
  }
  const activeSessionId =
    state.activeSessionId === id ? (visible.at(0)?.id ?? null) : state.activeSessionId;
  return {
    sessions,
    activeSessionId,
    knownWorkspaces: state.knownWorkspaces,
    knownSshTargets: state.knownSshTargets,
  };
}

export function patchSessionMeta(
  session: CodingAgentSession,
  patch: {
    conversationId?: string | null;
    title?: string;
    outpostInstanceId?: string | null;
  },
): CodingAgentSession {
  return {
    ...session,
    ...(patch.conversationId !== undefined ? { conversationId: patch.conversationId } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() || session.title } : {}),
    ...(patch.outpostInstanceId !== undefined
      ? { outpostInstanceId: patch.outpostInstanceId }
      : {}),
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
    const key = repoGroupKey(s);
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

function collectWorkspaceRoots(sessions: CodingAgentSession[]): string[] {
  const set = new Set<string>();
  for (const s of sessions) {
    if (s.workspaceKind === "local" && s.workspaceRoot) set.add(normalizeRoot(s.workspaceRoot));
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

function sanitizeKnownWorkspaces(raw: unknown, sessions: CodingAgentSession[]): string[] {
  const set = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const root = normalizeRoot(String(item ?? ""));
      if (root) set.add(root);
    }
  }
  for (const s of sessions) {
    if (s.workspaceKind === "local" && s.workspaceRoot) set.add(normalizeRoot(s.workspaceRoot));
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

function sshTargetKey(t: SshRemoteTarget): string {
  return `${t.user}@${t.host}:${t.port ?? 22}:${t.remoteWorkspace}`;
}

function sanitizeKnownSshTargets(raw: unknown): SshRemoteTarget[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, SshRemoteTarget>();
  for (const item of raw) {
    const t = sanitizeRemote(item);
    if (t) map.set(sshTargetKey(t), t);
  }
  return [...map.values()].toSorted((a, b) => sshTargetKey(a).localeCompare(sshTargetKey(b)));
}

export function listKnownWorkspaceRoots(state: AgentSessionsState): string[] {
  return sanitizeKnownWorkspaces(state.knownWorkspaces, state.sessions);
}

export function listKnownSshTargets(state: AgentSessionsState): SshRemoteTarget[] {
  return sanitizeKnownSshTargets([
    ...state.knownSshTargets,
    ...state.sessions.map((s) => s.remote).filter(Boolean),
  ]);
}

export function rememberWorkspace(
  state: AgentSessionsState,
  workspaceRoot: string,
): AgentSessionsState {
  const root = normalizeRoot(workspaceRoot);
  if (!root) return state;
  const exists = state.knownWorkspaces.some((w) => normalizeRoot(w) === root);
  if (exists) return state;
  return {
    ...state,
    knownWorkspaces: [...state.knownWorkspaces, root].toSorted((a, b) => a.localeCompare(b)),
  };
}

export function rememberSshTarget(
  state: AgentSessionsState,
  target: SshRemoteTarget,
): AgentSessionsState {
  const key = sshTargetKey(target);
  if (state.knownSshTargets.some((t) => sshTargetKey(t) === key)) return state;
  return {
    ...state,
    knownSshTargets: sanitizeKnownSshTargets([...state.knownSshTargets, target]),
  };
}
