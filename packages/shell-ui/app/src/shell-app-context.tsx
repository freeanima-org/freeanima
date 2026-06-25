import { createContext, useContext, type ReactNode } from "react";
import type { SettingsBinding } from "@freeanima/satellite-sdk/settings";

const ShellAppContext = createContext<{ bindings: SettingsBinding[] }>({ bindings: [] });

export function ShellAppProvider({
  bindings,
  children,
}: {
  bindings: SettingsBinding[];
  children: ReactNode;
}) {
  return <ShellAppContext.Provider value={{ bindings }}>{children}</ShellAppContext.Provider>;
}

export function useShellAppBindings(): SettingsBinding[] {
  return useContext(ShellAppContext).bindings;
}

/** 供 bootstrap 在 Provider 外读取（mount 前注入） */
let globalBindings: SettingsBinding[] = [];

export function setShellAppBindings(bindings: SettingsBinding[]): void {
  globalBindings = bindings;
}

export function getShellAppBindings(): SettingsBinding[] {
  return globalBindings;
}

export function findDebugStore(bindings: SettingsBinding[]) {
  return bindings.find((b) => b.section.id === "debug")?.store;
}
