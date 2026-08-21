import { asRecord } from "@freeanima/shared/util";
import { z } from "zod";

import { componentBodySchema, isKnownComponent, type ComponentId } from "./components/index.ts";

/** 从 body 去掉仅属于被删 component 的字段（其它剩余组件仍需要的键保留）。 */
export function stripRemovedComponentBodyFields(
  body: Record<string, unknown>,
  removed: ComponentId,
  remaining: readonly string[],
): Record<string, unknown> {
  const parsed = componentBodySchema(removed).safeParse(body);
  if (!parsed.success) return { ...body };
  const removedData = asRecord(parsed.data);
  if (!removedData) return { ...body };
  const next = { ...body };
  for (const key of Object.keys(removedData)) {
    const stillNeeded = remaining.some((tag) => {
      if (!isKnownComponent(tag)) return false;
      const other = componentBodySchema(tag).safeParse(body);
      const otherData = other.success ? asRecord(other.data) : null;
      return otherData != null && key in otherData;
    });
    if (!stillNeeded) delete next[key];
  }
  return next;
}

export function validateEntityBody(components: string[], body: unknown): Record<string, unknown> {
  const parsedBody = z.record(z.string(), z.unknown()).parse(body ?? {});
  const merged: Record<string, unknown> = { ...parsedBody };

  for (const tag of components) {
    if (!isKnownComponent(tag)) {
      throw new Error(`unknown component: ${tag}`);
    }
    const schema = componentBodySchema(tag);
    const result = schema.safeParse(parsedBody);
    if (!result.success) {
      throw new Error(`invalid body for component ${tag}: ${result.error.message}`);
    }
    Object.assign(merged, result.data);
  }

  return merged;
}

export function validatePrimaryComponentBody(
  primary_component: ComponentId,
  body: unknown,
): Record<string, unknown> {
  return validateEntityBody([primary_component], body);
}

export function mergeComponentBody(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  components: string[],
): Record<string, unknown> {
  const next = { ...existing, ...patch };
  return validateEntityBody(components, next);
}
