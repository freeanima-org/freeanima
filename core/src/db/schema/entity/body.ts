import { z } from "zod";

import { componentBodySchema, isKnownComponent, type ComponentId } from "./components/index.ts";

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
  primaryComponent: ComponentId,
  body: unknown,
): Record<string, unknown> {
  return validateEntityBody([primaryComponent], body);
}

export function mergeComponentBody(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  components: string[],
): Record<string, unknown> {
  const next = { ...existing, ...patch };
  return validateEntityBody(components, next);
}
