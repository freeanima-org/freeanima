import { resolveHubCacheScope } from "./offline-cache.ts";
import { getSubjectKind } from "./subject-scope-store.ts";
import type { SubjectKind } from "./subject-scope.ts";

const STORAGE_PREFIX = "freeanima.module-selection";

export type ModuleSelectionModule = "chat" | "tasks" | "email" | "project";

export type EmailModuleSelection = {
  accountId: number;
  messageId?: number | null;
};

export type TaskModuleSelection =
  | { kind: "smart_list"; key: string }
  | { kind: "list"; id: number };

export type ModuleSelectionContext = {
  hubScope?: string;
  subjectKind?: SubjectKind;
};

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function resolveContext(ctx?: ModuleSelectionContext): {
  hubScope: string;
  subjectKind: SubjectKind;
} {
  return {
    hubScope: ctx?.hubScope ?? resolveHubCacheScope(),
    subjectKind: ctx?.subjectKind ?? getSubjectKind(),
  };
}

function storageKey(module: ModuleSelectionModule, ctx?: ModuleSelectionContext): string {
  const { hubScope, subjectKind } = resolveContext(ctx);
  return `${STORAGE_PREFIX}:${hubScope}:${subjectKind}:${module}`;
}

function parseChatValue(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function parseTasksValue(raw: string | null): TaskModuleSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0) {
      return { kind: "list", id: parsed };
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.kind === "list" && typeof obj.id === "number" && obj.id > 0) {
      return { kind: "list", id: obj.id };
    }
    if (obj.kind === "smart_list" && typeof obj.key === "string" && obj.key.trim()) {
      return { kind: "smart_list", key: obj.key.trim() };
    }
  } catch {
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) return { kind: "list", id };
  }
  return null;
}

function parseEmailValue(raw: string | null): EmailModuleSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const accountId = (parsed as EmailModuleSelection).accountId;
    if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0)
      return null;
    const messageId = (parsed as EmailModuleSelection).messageId;
    if (messageId == null) return { accountId };
    if (typeof messageId === "number" && Number.isInteger(messageId) && messageId > 0) {
      return { accountId, messageId };
    }
    return { accountId };
  } catch {
    return null;
  }
}

function parseProjectValue(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0) return parsed;
  } catch {
    /* fall through */
  }
  const id = Number(raw);
  if (Number.isInteger(id) && id > 0) return id;
  return null;
}

export function readModuleSelection(module: "chat", ctx?: ModuleSelectionContext): string | null;
export function readModuleSelection(
  module: "tasks",
  ctx?: ModuleSelectionContext,
): TaskModuleSelection | null;
export function readModuleSelection(
  module: "email",
  ctx?: ModuleSelectionContext,
): EmailModuleSelection | null;
export function readModuleSelection(module: "project", ctx?: ModuleSelectionContext): number | null;
export function readModuleSelection(
  module: ModuleSelectionModule,
  ctx?: ModuleSelectionContext,
): string | TaskModuleSelection | EmailModuleSelection | number | null {
  try {
    const raw = storage()?.getItem(storageKey(module, ctx)) ?? null;
    if (module === "chat") return parseChatValue(raw);
    if (module === "tasks") return parseTasksValue(raw);
    if (module === "project") return parseProjectValue(raw);
    return parseEmailValue(raw);
  } catch {
    return null;
  }
}

export function writeModuleSelection(
  module: "chat",
  value: string | null,
  ctx?: ModuleSelectionContext,
): void;
export function writeModuleSelection(
  module: "tasks",
  value: TaskModuleSelection | null,
  ctx?: ModuleSelectionContext,
): void;
export function writeModuleSelection(
  module: "email",
  value: EmailModuleSelection | null,
  ctx?: ModuleSelectionContext,
): void;
export function writeModuleSelection(
  module: "project",
  value: number | null,
  ctx?: ModuleSelectionContext,
): void;
export function writeModuleSelection(
  module: ModuleSelectionModule,
  value: string | TaskModuleSelection | EmailModuleSelection | number | null,
  ctx?: ModuleSelectionContext,
): void {
  try {
    const store = storage();
    if (!store) return;
    const key = storageKey(module, ctx);
    if (value == null) {
      store.removeItem(key);
      return;
    }
    if (module === "chat") {
      const id = typeof value === "string" ? value.trim() : "";
      if (id) store.setItem(key, id);
      else store.removeItem(key);
      return;
    }
    if (module === "tasks") {
      if (
        value != null &&
        typeof value === "object" &&
        "kind" in value &&
        (value.kind === "list" || value.kind === "smart_list")
      ) {
        store.setItem(key, JSON.stringify(value));
      } else {
        store.removeItem(key);
      }
      return;
    }
    if (module === "project") {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        store.setItem(key, JSON.stringify(value));
      } else {
        store.removeItem(key);
      }
      return;
    }
    if (typeof value === "object" && "accountId" in value) {
      store.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

export function clearModuleSelection(
  module: ModuleSelectionModule,
  ctx?: ModuleSelectionContext,
): void {
  try {
    storage()?.removeItem(storageKey(module, ctx));
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

export function resetModuleSelectionForTest(): void {
  if (typeof localStorage === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`${STORAGE_PREFIX}:`)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
