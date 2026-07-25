import { writeFileSync } from "node:fs";
import {
  Config,
  parseRuntimeConfig,
  pickRuntimeDocument,
  type RuntimeConfig,
} from "@freeanima/host/core/config";
import { stringifyYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { loadConfigYamlRecord } from "./yaml-io.ts";

function readConfigFromDisk(): RuntimeConfig {
  /** 测试兼容：yaml 可能仍含 bootstrap 段，解析前剥离 */
  return parseRuntimeConfig(pickRuntimeDocument(loadConfigYamlRecord()));
}

/** File-backed config: read / reload / patch（测试与兼容；仅 runtime 段进内存） */
export class FileConfig extends Config {
  /** Startup: read disk + Zod validate + env expand */
  static open(): FileConfig {
    return new FileConfig(readConfigFromDisk());
  }

  /** Re-read config.yaml and update in-memory snapshot */
  reload(): RuntimeConfig {
    const next = readConfigFromDisk();
    this.update(next);
    return next;
  }

  /** Merge-write a config.yaml section then reload */
  patchSection(
    section: keyof RuntimeConfig | string,
    patch: Record<string, unknown>,
  ): RuntimeConfig {
    const raw = loadConfigYamlRecord();
    const existing =
      typeof raw[section] === "object" && raw[section] != null && !Array.isArray(raw[section])
        ? (raw[section] as Record<string, unknown>)
        : {};
    const merged = { ...existing, ...patch };
    raw[section] = merged;
    writeFileSync(PATHS.configYaml, stringifyYaml(raw), "utf-8");
    return this.reload();
  }
}
