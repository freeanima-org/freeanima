import { registerChatOfflineModule } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { registerDiaryOfflineModule } from "@freeanima/features/diary/ui/spa/lib/offline-store.ts";
import { registerPomodoroOfflineModule } from "@freeanima/features/pomodoro/ui/spa/lib/pomodoro-offline-adapter.ts";
import { registerTaskOfflineModule } from "@freeanima/features/task/ui/spa/lib/offline-store.ts";

let registered = false;

/** shell 启动时注册全部 Tier-2 可写模块，避免未进入功能页时全局 bar 无法统计/flush。 */
export function registerAllOfflineModules(): void {
  if (registered) return;
  registered = true;
  registerChatOfflineModule();
  registerDiaryOfflineModule();
  registerTaskOfflineModule();
  registerPomodoroOfflineModule();
}

export function resetOfflineModulesRegistrationForTests(): void {
  registered = false;
}
