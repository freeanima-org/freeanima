import { registerChatOfflineModule } from "@freeanima/ui-features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { registerDiaryOfflineModule } from "@freeanima/ui-features/diary/ui/spa/lib/offline-store.ts";
import { registerCalendarOfflineModule } from "@freeanima/ui-features/calendar/ui/spa/lib/offline-store.ts";
import { registerNoteOfflineModule } from "@freeanima/ui-features/note/ui/spa/lib/offline-store.ts";
import { registerPomodoroOfflineModule } from "@freeanima/ui-features/pomodoro/ui/spa/lib/pomodoro-offline-adapter.ts";
import { registerProjectOfflineModule } from "@freeanima/ui-features/project/ui/spa/lib/offline-store.ts";
import { registerTaskOfflineModule } from "@freeanima/ui-features/task/ui/spa/lib/offline-store.ts";

let registered = false;

/** shell 启动时注册全部 offlineWritable（outbox）模块，避免未进入功能页时全局 bar 无法统计/flush。 */
export function registerAllOfflineModules(): void {
  if (registered) return;
  registered = true;
  registerChatOfflineModule();
  registerDiaryOfflineModule();
  registerCalendarOfflineModule();
  registerTaskOfflineModule();
  registerProjectOfflineModule();
  registerPomodoroOfflineModule();
  registerNoteOfflineModule();
}

export function resetOfflineModulesRegistrationForTests(): void {
  registered = false;
}
