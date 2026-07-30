import { m } from "./i18n.ts";

export function mcpStatusLabel(status: string): string {
  if (status === "connected") return m.habitat_common_connected();
  if (status === "connecting") return m.habitat_common_connecting();
  if (status === "disabled") return m.habitat_common_disabled();
  if (status === "error") return m.habitat_common_error();
  return m.habitat_common_not_started();
}

export function dependencyStatusLabel(status: string): string {
  if (status === "connected") return m.habitat_common_connected();
  if (status === "error") return m.habitat_common_abnormal();
  return m.habitat_common_not_configured();
}

export function memoryTypeLabel(type: string): string {
  if (type === "semantic") return m.habitat_memory_type_semantic();
  if (type === "conversation") return m.habitat_memory_type_conversation();
  if (type === "limbic") return m.habitat_memory_type_limbic();
  if (type === "autobiographical") return m.habitat_memory_type_autobio();
  return type;
}
