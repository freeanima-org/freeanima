import { SUBJECT_SCOPE_STORAGE_KEY, type SubjectKind } from "./subject-scope.ts";

const DEFAULT_KIND: SubjectKind = "user";

type Listener = () => void;

let kind: SubjectKind = readStoredKind();
const listeners = new Set<Listener>();

function readStoredKind(): SubjectKind {
  if (typeof sessionStorage === "undefined") return DEFAULT_KIND;
  const raw = sessionStorage.getItem(SUBJECT_SCOPE_STORAGE_KEY);
  return raw === "agent" ? "agent" : DEFAULT_KIND;
}

function writeStoredKind(next: SubjectKind): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SUBJECT_SCOPE_STORAGE_KEY, next);
  }
}

export function getSubjectKind(): SubjectKind {
  return kind;
}

export function setSubjectKind(next: SubjectKind): void {
  if (kind === next) return;
  kind = next;
  writeStoredKind(next);
  for (const listener of listeners) listener();
}

export function subscribeSubjectKind(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetSubjectScopeForTest(): void {
  kind = DEFAULT_KIND;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SUBJECT_SCOPE_STORAGE_KEY);
  }
  for (const listener of listeners) listener();
}
