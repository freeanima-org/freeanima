const STORAGE_KEY = "freeanima.shell-modules.visible";

export type ShellModuleId =
  | "chat"
  | "rooms"
  | "tasks"
  | "projects"
  | "objectives"
  | "calendar"
  | "pomodoro"
  | "email"
  | "diary"
  | "notes"
  | "bookmarks"
  | "health"
  | "contacts"
  | "entity"
  | "vault"
  | "notifications"
  | "bedroom"
  | "habitat"
  | "settings";

export const SHELL_MODULE_IDS: ShellModuleId[] = [
  "chat",
  "rooms",
  "tasks",
  "projects",
  "objectives",
  "calendar",
  "pomodoro",
  "email",
  "diary",
  "notes",
  "bookmarks",
  "health",
  "contacts",
  "entity",
  "vault",
  "notifications",
  "bedroom",
  "habitat",
  "settings",
];

/** 不可关闭（保证能回到设置页重新开启） */
export const SHELL_MODULE_LOCKED: ShellModuleId[] = ["chat", "settings"];

const DEFAULT_VISIBLE = new Set<ShellModuleId>(SHELL_MODULE_IDS);

type VisibilityListener = () => void;
const listeners = new Set<VisibilityListener>();

let memoryFallback: Set<ShellModuleId> | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function isShellModuleId(id: string): id is ShellModuleId {
  return (SHELL_MODULE_IDS as readonly string[]).includes(id);
}

/** 旧 localStorage 值 `console` → `habitat`；`observer` → `bedroom`（只读兼容，写出用新 id） */
function migrateModuleId(id: string): string {
  if (id === "console") return "habitat";
  if (id === "observer") return "bedroom";
  return id;
}

function parseVisible(raw: string | null): Set<ShellModuleId> {
  if (!raw) return new Set(DEFAULT_VISIBLE);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE);
    const ids = parsed
      .filter((id): id is string => typeof id === "string")
      .map(migrateModuleId)
      .filter((id): id is ShellModuleId => isShellModuleId(id));
    for (const locked of SHELL_MODULE_LOCKED) {
      if (!ids.includes(locked)) ids.push(locked);
    }
    // 新顶级模块默认可见（旧 localStorage 未列出时补上）
    if (!ids.includes("bedroom")) ids.push("bedroom");
    if (!ids.includes("rooms")) ids.push("rooms");
    if (!ids.includes("health")) ids.push("health");
    return ids.length > 0 ? new Set(ids) : new Set(DEFAULT_VISIBLE);
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

function serializeVisible(visible: Set<ShellModuleId>): string {
  return JSON.stringify(SHELL_MODULE_IDS.filter((id) => visible.has(id)));
}

export function readShellModuleVisibility(): Set<ShellModuleId> {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) ?? null;
    if (raw == null && memoryFallback) return new Set(memoryFallback);
    return parseVisible(raw);
  } catch {
    return memoryFallback ? new Set(memoryFallback) : new Set(DEFAULT_VISIBLE);
  }
}

export function writeShellModuleVisibility(visible: Set<ShellModuleId>): void {
  const next = new Set<ShellModuleId>(visible);
  for (const locked of SHELL_MODULE_LOCKED) {
    next.add(locked);
  }
  try {
    const store = storage();
    if (store) {
      store.setItem(STORAGE_KEY, serializeVisible(next));
    } else {
      memoryFallback = next;
    }
  } catch {
    memoryFallback = next;
  }
  for (const listener of listeners) listener();
}

export function isShellModuleVisible(id: ShellModuleId): boolean {
  return readShellModuleVisibility().has(id);
}

export function subscribeShellModuleVisibility(listener: VisibilityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveShellModuleIdFromPath(pathname: string): ShellModuleId | null {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  if (path.startsWith("/rooms") || path.startsWith("/chat/rooms")) return "rooms";
  if (path.startsWith("/chat")) return "chat";
  if (path.startsWith("/tasks")) return "tasks";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/objectives")) return "objectives";
  if (path.startsWith("/calendar")) return "calendar";
  if (path.startsWith("/pomodoro")) return "pomodoro";
  if (path.startsWith("/email")) return "email";
  if (path.startsWith("/diary")) return "diary";
  if (path.startsWith("/note")) return "notes";
  if (path.startsWith("/bookmarks")) return "bookmarks";
  if (path.startsWith("/health")) return "health";
  if (path.startsWith("/contacts")) return "contacts";
  if (path.startsWith("/entity")) return "entity";
  if (path.startsWith("/vault")) return "vault";
  if (path.startsWith("/notifications")) return "notifications";
  if (path.startsWith("/bedroom") || path.startsWith("/observer")) return "bedroom";
  if (path.startsWith("/habitat") || path.startsWith("/console")) return "habitat";
  if (path.startsWith("/settings")) return "settings";
  return null;
}

const MODULE_DEFAULT_PATH: Record<ShellModuleId, string> = {
  chat: "/chat",
  rooms: "/rooms",
  tasks: "/tasks",
  projects: "/projects",
  objectives: "/objectives",
  calendar: "/calendar",
  pomodoro: "/pomodoro",
  email: "/email",
  diary: "/diary",
  notes: "/note",
  bookmarks: "/bookmarks",
  health: "/health",
  contacts: "/contacts",
  entity: "/entity",
  vault: "/vault",
  notifications: "/notifications",
  bedroom: "/bedroom/self-layer",
  habitat: "/habitat/dashboard",
  settings: "/settings",
};

export function resolveDefaultVisibleModulePath(
  visible?: Set<ShellModuleId>,
  order: ShellModuleId[] = SHELL_MODULE_IDS,
): string {
  const set = visible ?? readShellModuleVisibility();
  for (const id of order) {
    if (set.has(id)) return MODULE_DEFAULT_PATH[id];
  }
  return "/chat";
}

export function resetShellModuleVisibilityForTest(): void {
  memoryFallback = null;
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
