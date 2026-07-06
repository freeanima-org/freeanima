import { m } from "./i18n.ts";

export function mcpStatusLabel(status: string): string {
  if (status === "connected") return m.console_common_connected();
  if (status === "connecting") return m.console_common_connecting();
  if (status === "disabled") return m.console_common_disabled();
  if (status === "error") return m.console_common_error();
  return m.console_common_not_started();
}

export function acpStatusLabel(status: string): string {
  if (status === "connected") return m.console_common_connected();
  if (status === "starting") return m.console_common_connecting();
  if (status === "error") return m.console_common_error();
  if (status === "disabled") return m.console_common_disabled();
  return m.console_common_not_connected();
}

export function dependencyStatusLabel(status: string): string {
  if (status === "connected") return m.console_common_connected();
  if (status === "error") return m.console_common_abnormal();
  return m.console_common_not_configured();
}

export function memoryTypeLabel(type: string): string {
  if (type === "semantic") return m.console_memory_type_semantic();
  if (type === "conversation") return m.console_memory_type_conversation();
  if (type === "limbic") return m.console_memory_type_limbic();
  if (type === "autobiographical") return m.console_memory_type_autobio();
  return type;
}
