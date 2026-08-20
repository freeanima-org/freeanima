import { z } from "zod";

/** 数据维能力片段 — token.authorization.data 与 CapabilityPolicy.data 同形 */
export const dataCapabilityFragmentSchema = z.object({
  allowed_components: z.array(z.string().min(1)).default([]),
  denied_components: z.array(z.string().min(1)).default([]),
  allowed_worlds: z.array(z.union([z.literal("*"), z.number().int().positive()])).default([]),
  denied_worlds: z.array(z.number().int().positive()).default([]),
  access: z.enum(["read", "write"]).default("read"),
});

export type DataCapabilityFragment = z.infer<typeof dataCapabilityFragmentSchema>;

export type DataCapabilityCheck = {
  component?: string;
  worldId?: number;
  access?: "read" | "write";
};

export class DataCapabilityError extends Error {
  readonly code: "component_denied" | "world_denied" | "access_denied";

  constructor(code: DataCapabilityError["code"], message: string) {
    super(message);
    this.name = "DataCapabilityError";
    this.code = code;
  }
}

const OPEN_DATA: DataCapabilityFragment = {
  allowed_components: ["*"],
  denied_components: [],
  allowed_worlds: ["*"],
  denied_worlds: [],
  access: "write",
};

/** 全开数据维（full token / app·mcp 预设默认） */
export function openDataCapability(): DataCapabilityFragment {
  return {
    ...OPEN_DATA,
    allowed_components: ["*"],
    allowed_worlds: ["*"],
    denied_components: [],
    denied_worlds: [],
  };
}

export function parseDataCapabilityFragment(raw: unknown): DataCapabilityFragment {
  return dataCapabilityFragmentSchema.parse(raw);
}

function accessMeets(have: "read" | "write", need: "read" | "write"): boolean {
  if (need === "read") return have === "read" || have === "write";
  return have === "write";
}

function componentAllowed(data: DataCapabilityFragment, component: string): boolean {
  if (data.denied_components.includes(component) || data.denied_components.includes("*")) {
    return false;
  }
  if (data.allowed_components.includes("*")) return true;
  return data.allowed_components.includes(component);
}

function worldAllowed(data: DataCapabilityFragment, worldId: number): boolean {
  if (data.denied_worlds.includes(worldId)) return false;
  if (data.allowed_worlds.includes("*")) return true;
  return data.allowed_worlds.some((w) => w === worldId);
}

/** 断言数据维；失败抛 DataCapabilityError */
export function assertDataCapability(
  data: DataCapabilityFragment,
  check: DataCapabilityCheck,
): void {
  const need = check.access ?? "read";
  if (!accessMeets(data.access, need)) {
    throw new DataCapabilityError(
      "access_denied",
      `data access ${data.access} cannot satisfy ${need}`,
    );
  }
  if (check.component != null) {
    if (!componentAllowed(data, check.component)) {
      throw new DataCapabilityError(
        "component_denied",
        `component ${check.component} not allowed by data capability`,
      );
    }
  }
  if (check.worldId != null) {
    if (!worldAllowed(data, check.worldId)) {
      throw new DataCapabilityError(
        "world_denied",
        `world ${check.worldId} not allowed by data capability`,
      );
    }
  }
}

/** 列表求交：保留仍被 data 允许的 world id */
export function filterWorldIdsByDataCapability(
  worldIds: readonly number[],
  data: DataCapabilityFragment,
): number[] {
  return worldIds.filter((id) => worldAllowed(data, id));
}

export function isComponentAllowedByData(data: DataCapabilityFragment, component: string): boolean {
  return componentAllowed(data, component);
}

export function isWorldAllowedByData(data: DataCapabilityFragment, worldId: number): boolean {
  return worldAllowed(data, worldId);
}
