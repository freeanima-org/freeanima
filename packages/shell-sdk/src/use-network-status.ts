import { useEffect, useState } from "react";

export function useNetworkStatus(): boolean {
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

/** 浏览器离线或 Hub 实时通道不可用时的只读约束（当前仅检测 navigator.onLine） */
export function useOfflineReadOnly(): boolean {
  return !useNetworkStatus();
}
