export { SubjectScopeProvider, useSubjectScope } from "./subject-scope-react.tsx";
export { SubjectToggle } from "./SubjectToggle.tsx";
export { SubjectScopeToggle } from "./SubjectScopeToggle.tsx";
export {
  hasEnterToSendCapability,
  hasFinePointerCapability,
  hasTouchPrimaryCapability,
} from "./shell-capability.ts";
export type { PrimaryInputKind } from "./shell-capability.ts";
export {
  useActionSheetCapability,
  useContextMenuCapability,
  useEnterToSendCapability,
  useFinePointerCapability,
  useOpenHabitatSettingsCapability,
  useShellKind,
  useTouchPrimaryCapability,
} from "./shell-capability-react.tsx";
export {
  canOpenHabitatSettings,
  getShellKind,
  isNativeShell,
  isPackagedShell,
  shouldUseNativeShellNavigation,
} from "./shell-runtime.ts";
export type { ShellRuntimeKind } from "./shell-runtime.ts";
export {
  useSetShellModuleVisibility,
  useShellModuleVisibility,
} from "./shell-module-visibility-react.tsx";
export { useSetShellModuleOrder, useShellModuleOrder } from "./shell-module-order-react.tsx";
export {
  useSetShellModulePrimaryCount,
  useShellModulePrimaryCount,
} from "./shell-module-primary-count-react.tsx";
export { useColorTheme, useSetColorTheme } from "./color-theme-react.tsx";
export { useChatLlmDebugEnabled, useSetChatLlmDebugEnabled } from "./chat-prefs-react.tsx";
export { useShellQuickEntries, useShellQuickIdSet } from "./shell-quick-react.tsx";
export { useNetworkOnline } from "./use-network-status.ts";
export { useHabitatConnection } from "./use-habitat-connection.ts";
export { useLocalPrefer } from "./use-local-prefer.ts";
export { reconnectHabitat } from "./habitat-connection.ts";
export { clearLocalPrefer, isLocalPreferActive } from "./local-prefer.ts";
export type { HabitatConnectionState } from "./habitat-connection.ts";
export { useCompactImmersive, useSetCompactImmersive } from "./compact-immersive-react.tsx";
export {
  getCompactImmersive,
  setCompactImmersive,
  resetCompactImmersiveForTest,
} from "./compact-immersive-store.ts";
export { getUserVaultSession, VAULT_UI_SCOPE } from "./vault/user-vault-session.ts";
export type { UserVaultSessionState, UserVaultUnlockInput } from "./vault/user-vault-session.ts";
export { registerVaultRpcHandlers } from "./vault/vault-rpc-handlers.ts";
