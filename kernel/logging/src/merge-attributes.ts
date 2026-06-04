import type { LogAttributes } from "./types";

export function mergeAttributes(...parts: (LogAttributes | undefined)[]): LogAttributes {
  const merged: LogAttributes = {};
  for (const part of parts) {
    if (!part) continue;
    Object.assign(merged, part);
  }
  return merged;
}

export function hasComponent(attributes: LogAttributes): boolean {
  return typeof attributes.component === "string" && attributes.component.length > 0;
}
