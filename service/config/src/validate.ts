import { readFileSync, existsSync } from "node:fs";
import { expandConfigEnv } from "./env-expand.ts";
import { parseYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { startupConfigSchema } from "./schemas/startup-config.ts";

/** 启动时校验 config.yaml 结构（不展开 env/credential 引用） */
export async function validateConfigOnStartup(): Promise<void> {
  if (!existsSync(PATHS.configYaml)) {
    console.error(`config.yaml 不存在: ${PATHS.configYaml}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    data = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`config.yaml 解析失败: ${msg}`);
    process.exit(1);
  }

  const parsed = startupConfigSchema.safeParse(data);
  if (!parsed.success) {
    console.error("config.yaml 校验失败:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }
}
