import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import type { SubjectKind } from "./subject-scope.ts";
import { getSubjectKind, setSubjectKind, subscribeSubjectKind } from "./subject-scope-store.ts";

type SubjectScopeValue = {
  kind: SubjectKind;
  setKind: (kind: SubjectKind) => void;
};

const SubjectScopeContext = createContext<SubjectScopeValue | null>(null);

export function SubjectScopeProvider({ children }: { children: ReactNode }) {
  const kind = useSyncExternalStore(
    subscribeSubjectKind,
    getSubjectKind,
    () => DEFAULT_SERVER_KIND,
  );
  const value: SubjectScopeValue = {
    kind,
    setKind: setSubjectKind,
  };
  return <SubjectScopeContext.Provider value={value}>{children}</SubjectScopeContext.Provider>;
}

const DEFAULT_SERVER_KIND: SubjectKind = "user";

export function useSubjectScope(): SubjectScopeValue {
  const ctx = useContext(SubjectScopeContext);
  if (!ctx) {
    throw new Error("useSubjectScope must be used within SubjectScopeProvider");
  }
  return ctx;
}
