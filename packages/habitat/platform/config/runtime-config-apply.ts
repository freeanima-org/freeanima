import type { Config } from "@freeanima/habitat/core/config";
import {
  applyConfigSection,
  listTransferredSectionKeys,
} from "@freeanima/habitat/kernel/config-mechanism";
import { logComponent } from "@freeanima/habitat/platform/logging";

import {
  bindRuntimeConfigApplyDeps,
  registerRuntimeConfigApplies,
  resetRuntimeConfigApplyDepsForTest,
  type RuntimeConfigApplyDeps,
} from "./register-runtime-applies.ts";

const log = logComponent("config-apply");

// 确保产品 apply 已挂上注册表（模块副作用 + 显式调用）
registerRuntimeConfigApplies();

export type { RuntimeConfigApplyDeps };
export {
  bindRuntimeConfigApplyDeps,
  resetRuntimeConfigApplyDepsForTest,
  registerRuntimeConfigApplies,
};

/** 改 snapshot 不够、须 re-bind 的运行时段（读注册表 transferred） */
export const TRANSFERRED_RUNTIME_SECTIONS: readonly string[] = listTransferredSectionKeys();

export type TransferredRuntimeSection = string;

/**
 * 将内存中的 runtime 配置段应用到已转存的子系统。
 * live 段（compression / memory 等）无 apply 则为 no-op。
 * `@` / `*` 表示对全部 transferred 段执行 apply（reload 用）。
 * 入参为整份 Config。
 */
export async function applyRuntimeConfigSection(config: Config, section: string): Promise<void> {
  await applyConfigSection(config, section, {
    info: (msg) => log.info(msg),
    error: (msg, attrs) => log.error(msg, attrs),
  });
}
