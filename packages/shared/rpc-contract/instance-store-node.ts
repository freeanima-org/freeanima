import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { asRecord } from "@freeanima/shared/util";
import type { RemoteInstanceStore } from "./instance-store.ts";

export function fileRemoteInstanceStore(filePath: string): RemoteInstanceStore {
  return {
    load(): string | null {
      if (!existsSync(filePath)) return null;
      try {
        const raw: unknown = JSON.parse(readFileSync(filePath, "utf-8"));
        const record = asRecord(raw);
        return typeof record?.instance_id === "string" ? record.instance_id.trim() || null : null;
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
