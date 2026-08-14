import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PATHS } from "@freeanima/habitat/core/config/paths";
import { z } from "zod";

const dreamStateSchema = z.object({
  last_day: z.string().optional(),
  last_run_at: z.string().optional(),
  last_skipped: z.string().optional(),
  last_dream_id: z.union([z.string(), z.number()]).optional(),
});

export type DreamState = z.infer<typeof dreamStateSchema>;

function dreamStatePath(): string {
  return join(PATHS.home, "runtime", "dream_state.json");
}

export function readDreamState(): DreamState {
  const path = dreamStatePath();
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const parsed = dreamStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function recordDreamRun(update: DreamState): DreamState {
  const path = dreamStatePath();
  const dir = join(PATHS.home, "runtime");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const next = { ...readDreamState(), ...update, last_run_at: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
