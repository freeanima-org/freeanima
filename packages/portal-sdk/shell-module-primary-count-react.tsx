import { useCallback, useEffect, useState } from "react";

import {
  readShellModulePrimaryCount,
  subscribeShellModulePrimaryCount,
  writeShellModulePrimaryCount,
} from "./shell-module-primary-count.ts";

export function useShellModulePrimaryCount(): number | null {
  const [count, setCount] = useState(() => readShellModulePrimaryCount());

  const sync = useCallback(() => setCount(readShellModulePrimaryCount()), []);

  useEffect(() => {
    sync();
    return subscribeShellModulePrimaryCount(sync);
  }, [sync]);

  return count;
}

export function useSetShellModulePrimaryCount(): (count: number | null) => void {
  return useCallback((next: number | null) => writeShellModulePrimaryCount(next), []);
}
