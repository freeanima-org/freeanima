import { useCallback, useEffect, useState } from "react";

import {
  readShellModuleOrder,
  subscribeShellModuleOrder,
  writeShellModuleOrder,
} from "./shell-module-order.ts";
import type { ShellModuleId } from "./shell-module-visibility.ts";

export function useShellModuleOrder(): ShellModuleId[] {
  const [order, setOrder] = useState(() => readShellModuleOrder());

  const sync = useCallback(() => setOrder(readShellModuleOrder()), []);

  useEffect(() => {
    sync();
    return subscribeShellModuleOrder(sync);
  }, [sync]);

  return order;
}

export function useSetShellModuleOrder(): (order: ShellModuleId[]) => void {
  return useCallback((next: ShellModuleId[]) => writeShellModuleOrder(next), []);
}
