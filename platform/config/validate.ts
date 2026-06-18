import { readFileSync, existsSync } from "node:fs";
import { expandConfigEnv } from "./env-expand.ts";
import { parseYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { animaConfigSchema } from "@freeanima/core/config";

/** Validate config.yaml structure at startup (does not expand env/credential references) */
export async function validateConfigOnStartup(): Promise<void> {
  if (!existsSync(PATHS.configYaml)) {
    console.error(`config.yaml does not exist: ${PATHS.configYaml}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    data = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`config.yaml parse failed: ${msg}`);
    process.exit(1);
  }

  const parsed = animaConfigSchema.safeParse(data);
  if (!parsed.success) {
    console.error("config.yaml validation failed:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }
}
