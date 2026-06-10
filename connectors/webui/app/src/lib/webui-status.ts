import { m } from "./i18n.ts";

export function mcpStatusLabel(status: string): string {
  if (status === "connected") return m.webui_common_connected();
  if (status === "connecting") return m.webui_common_connecting();
  if (status === "disabled") return m.webui_common_disabled();
  if (status === "error") return m.webui_common_error();
  return m.webui_common_not_started();
}

export function acpStatusLabel(status: string): string {
  if (status === "connected") return m.webui_common_connected();
  if (status === "starting") return m.webui_common_connecting();
  if (status === "error") return m.webui_common_error();
  if (status === "disabled") return m.webui_common_disabled();
  return m.webui_common_not_configured();
}

export function dependencyStatusLabel(status: string): string {
  if (status === "connected") return m.webui_common_connected();
  if (status === "error") return m.webui_common_abnormal();
  return m.webui_common_not_configured();
}

export function memoryTypeLabel(type: string): string {
  if (type === "semantic") return m.webui_chamber_memory_type_semantic();
  if (type === "session") return m.webui_chamber_memory_type_session();
  if (type === "limbic") return m.webui_chamber_memory_type_limbic();
  if (type === "autobiographical") return m.webui_chamber_memory_type_autobio();
  return type;
}
