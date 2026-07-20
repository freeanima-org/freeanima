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
  useOpenHubSettingsCapability,
  useShellKind,
  useTouchPrimaryCapability,
} from "./shell-capability-react.tsx";
export {
  canOpenHabitatSettings,
  detectShellRuntimeKind,
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
export { useColorTheme, useSetColorTheme } from "./color-theme-react.tsx";
export { useChatLlmDebugEnabled, useSetChatLlmDebugEnabled } from "./chat-prefs-react.tsx";
export { useNetworkOnline } from "./use-network-status.ts";
export { useHabitatConnection } from "./use-habitat-connection.ts";
export { reconnectHabitat } from "./habitat-connection.ts";
export type { HabitatConnectionState } from "./habitat-connection.ts";
export { getUserVaultSession, VAULT_UI_SCOPE } from "./vault/user-vault-session.ts";
export type { UserVaultSessionState, UserVaultUnlockInput } from "./vault/user-vault-session.ts";
export { registerVaultRpcHandlers } from "./vault/vault-rpc-handlers.ts";
