export {
  isSystemdManaged,
  triggerServiceRestart,
  SYSTEMD_UNIT,
} from "@freeanima/service-api/process-restart";

import { triggerServiceRestart } from "@freeanima/service-api/process-restart";

/** 延迟后触发服务重启（HTTP 响应应先返回） */
export function scheduleServiceRestart(delayMs = 100): void {
  setTimeout(() => {
    void triggerServiceRestart();
  }, delayMs);
}
