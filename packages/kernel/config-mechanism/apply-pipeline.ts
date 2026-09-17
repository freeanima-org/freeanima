import type { Config } from "./config-store.ts";
import { getSectionRegistration, listTransferredSectionKeys } from "./section-registry.ts";

export type ApplySectionLog = {
  info?: (msg: string) => void;
  error?: (msg: string, attrs?: Record<string, unknown>) => void;
};

/**
 * 按 section 调度热 apply。
 * - `"*"` / `"@"`：全部 transferred 段
 * - 其它 key：若该段注册了 apply 则只跑该段（含非 transferred，如历史 fts case）
 * 入参始终为整份 Config（非段切片）。
 */
export async function applyConfigSection(
  config: Config,
  section: string,
  log?: ApplySectionLog,
): Promise<void> {
  const sections: string[] =
    section === "*" || section === "@"
      ? listTransferredSectionKeys()
      : getSectionRegistration(section)?.apply
        ? [section]
        : [];

  for (const key of sections) {
    const entry = getSectionRegistration(key);
    const apply = entry?.apply;
    if (!apply) continue;
    try {
      await apply(config);
      log?.info?.(`runtime config applied: ${key}`);
    } catch (err) {
      log?.error?.(`runtime config apply failed: ${key}`, { err });
      throw new Error(
        `配置已写入数据库，但热应用「${key}」失败: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }
}
