import { useCallback, useEffect, useState } from "react";

import {
  readChatLlmDebugEnabled,
  subscribeChatLlmDebugEnabled,
  writeChatLlmDebugEnabled,
} from "./chat-prefs.ts";

export function useChatLlmDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => readChatLlmDebugEnabled());

  const sync = useCallback(() => setEnabled(readChatLlmDebugEnabled()), []);

  useEffect(() => {
    sync();
    return subscribeChatLlmDebugEnabled(sync);
  }, [sync]);

  return enabled;
}

export function useSetChatLlmDebugEnabled(): (enabled: boolean) => void {
  return useCallback((enabled: boolean) => writeChatLlmDebugEnabled(enabled), []);
}
