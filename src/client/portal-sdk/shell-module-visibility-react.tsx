import { useCallback, useEffect, useState } from "react";

import {
  readShellModuleVisibility,
  subscribeShellModuleVisibility,
  writeShellModuleVisibility,
  type ShellModuleId,
} from "./shell-module-visibility.ts";

export function useShellModuleVisibility(): Set<ShellModuleId> {
  const [visible, setVisible] = useState(() => readShellModuleVisibility());

  const sync = useCallback(() => setVisible(readShellModuleVisibility()), []);

  useEffect(() => {
    sync();
    return subscribeShellModuleVisibility(sync);
  }, [sync]);

  return visible;
}

export function useSetShellModuleVisibility(): (visible: Set<ShellModuleId>) => void {
  return useCallback((next: Set<ShellModuleId>) => writeShellModuleVisibility(next), []);
}
