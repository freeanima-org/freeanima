import { useEffect, useEffectEvent } from "react";

import { subscribeIdMappings, type IdMappingEvent } from "./offline-id-map.ts";
import type { OfflineModuleId } from "./offline-outbox.ts";

/**
 * 订阅指定 offline 模块的 temp→server id remap。
 * onRemap 经 useEffectEvent，避免把 setState 闭包放进 effect 依赖。
 */
export function useIdMappingRemap(
  moduleId: OfflineModuleId,
  onRemap: (event: IdMappingEvent) => void,
): void {
  const onRemapEvent = useEffectEvent(onRemap);

  useEffect(() => {
    return subscribeIdMappings((event) => {
      if (event.moduleId !== moduleId) return;
      onRemapEvent(event);
    });
  }, [moduleId, onRemapEvent]);
}
