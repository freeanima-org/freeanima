import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { SapInstanceStore } from "./instance-store.ts";

export function fileSapInstanceStore(filePath: string): SapInstanceStore {
  return {
    load(): string | null {
      if (!existsSync(filePath)) return null;
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf-8")) as { instance_id?: string };
        return raw.instance_id?.trim() || null;
      } catch {
        return null;
      }
    },
    save(instanceId: string): void {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify({ instance_id: instanceId.trim() }, null, 2), "utf-8");
    },
  };
}
