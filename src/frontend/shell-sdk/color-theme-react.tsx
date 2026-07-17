import { useCallback, useEffect, useState } from "react";

import {
  readColorTheme,
  subscribeColorTheme,
  writeColorTheme,
  type ColorThemeId,
} from "./color-theme.ts";

export function useColorTheme(): ColorThemeId {
  const [theme, setTheme] = useState(() => readColorTheme());

  const sync = useCallback(() => setTheme(readColorTheme()), []);

  useEffect(() => {
    sync();
    return subscribeColorTheme(sync);
  }, [sync]);

  return theme;
}

export function useSetColorTheme(): (theme: ColorThemeId) => void {
  return useCallback((next: ColorThemeId) => writeColorTheme(next), []);
}
