import { useEffect, useState } from "react";

/** 设备/浏览器是否在线（navigator.onLine + online/offline 事件） */
export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

/** @deprecated 使用 useNetworkOnline */
export function useNetworkStatus(): boolean {
  return useNetworkOnline();
}
