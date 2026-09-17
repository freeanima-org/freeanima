import { useCallback, useEffect, useState } from "react";

import {
  ensureChatLlmDebugPrefsLoaded,
  readChatLlmDebugEnabled,
  subscribeChatLlmDebugEnabled,
  writeChatLlmDebugEnabled,
} from "./chat-prefs.ts";

export function useChatLlmDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => readChatLlmDebugEnabled());

  const sync = useCallback(() => setEnabled(readChatLlmDebugEnabled()), []);

  useEffect(() => {
    void ensureChatLlmDebugPrefsLoaded().then(sync);
    return subscribeChatLlmDebugEnabled(sync);
  }, [sync]);

  return enabled;
}

export function useSetChatLlmDebugEnabled(): (enabled: boolean) => void {
  return useCallback((enabled: boolean) => {
    writeChatLlmDebugEnabled(enabled);
  }, []);
}
