import { z, type ZodType } from "zod";

import type { Config } from "./config-store.ts";

export type SectionApplyFn = (config: Config) => void | Promise<void>;

export type RegisterSectionInput = {
  key: string;
  schema?: ZodType;
  apply?: SectionApplyFn;
  /** true 则 `"*"` / `"@"` reload 会跑该段 apply */
  transferred?: boolean;
  /** transferred 调度顺序（越小越先）；默认 0 */
  order?: number;
};

export type SectionRegistration = {
  key: string;
  schema?: ZodType;
  apply?: SectionApplyFn;
  transferred: boolean;
  order: number;
};

const registry = new Map<string, SectionRegistration>();

/** 注册或合并同 key 的 section（schema / apply / transferred / order） */
export function registerSection(input: RegisterSectionInput): void {
  const prev = registry.get(input.key);
  const schema = input.schema ?? prev?.schema;
  const apply = input.apply ?? prev?.apply;
  const transferred = input.transferred ?? prev?.transferred ?? false;
  const order = input.order ?? prev?.order ?? 0;
  const next: SectionRegistration = { key: input.key, transferred, order };
  if (schema !== undefined) next.schema = schema;
  if (apply !== undefined) next.apply = apply;
  registry.set(input.key, next);
}

export function getSectionRegistration(key: string): SectionRegistration | undefined {
  return registry.get(key);
}

export function listSectionKeys(): string[] {
  return [...registry.keys()];
}

export function listTransferredSectionKeys(): string[] {
  return [...registry.values()]
    .filter((e) => e.transferred)
    .toSorted((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((e) => e.key);
}

export function listSectionRegistrations(): SectionRegistration[] {
  return [...registry.values()];
}

/** 由已注册 schema 聚合 runtime 文档 schema（partial + passthrough） */
export function buildRuntimeConfigSchemaFromRegistry(): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, ZodType> = {};
  for (const entry of registry.values()) {
    if (entry.schema) shape[entry.key] = entry.schema;
  }
  return z.object(shape).partial().passthrough();
}

export function unregisterSection(key: string): void {
  registry.delete(key);
}

/** 单测隔离（会清掉产品段；优先用 unregisterSection） */
export function resetSectionRegistryForTest(): void {
  registry.clear();
}
