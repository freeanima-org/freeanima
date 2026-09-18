/** Anima URI：纯解析/格式化在 @freeanima/shared/anima-uri；此处只保留壳导航副作用。 */
import {
  animaUriToShellPath,
  defaultPresentForComponent,
  type AnimaUriRef,
} from "@freeanima/shared/anima-uri";

import { writeModuleSelection } from "./module-selection.ts";
import { navigateAppModulePath } from "./pomodoro-launch.ts";

export * from "@freeanima/shared/anima-uri";

/** Navigate Shell for present=navigate (or when overlay is unavailable). */
export function navigateAnimaUri(ref: AnimaUriRef): boolean {
  const path = animaUriToShellPath({
    ...ref,
    present: ref.present ?? defaultPresentForComponent(ref.component),
  });
  if (!path) return false;
  // 同模块内切清单时 TaskApp 已挂载，需同步持久化选型，避免只改 URL 不换列表
  if (ref.component === "task_list" && Number.isInteger(ref.id) && ref.id > 0) {
    writeModuleSelection("tasks", { kind: "list", id: ref.id });
  }
  navigateAppModulePath(path);
  return true;
}
