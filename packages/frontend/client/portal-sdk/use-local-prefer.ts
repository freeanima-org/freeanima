import { useEffect, useState } from "react";

import { isLocalPreferActive, subscribeLocalPrefer } from "./local-prefer.ts";

/** 弱网探测后的本地优先：跳过 Habitat RPC，走 snapshot / outbox。 */
export function useLocalPrefer(): boolean {
  const [active, setActive] = useState(() => isLocalPreferActive());

  useEffect(() => {
    setActive(isLocalPreferActive());
    return subscribeLocalPrefer(setActive);
  }, []);

  return active;
}
