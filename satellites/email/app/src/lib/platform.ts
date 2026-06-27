import { useEffect, useState } from "react";

const MOBILE_LAYOUT_MQ = "(max-width: 1023px)";

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_LAYOUT_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}
