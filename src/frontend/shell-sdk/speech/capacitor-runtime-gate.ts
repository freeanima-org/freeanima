import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "../capacitor-runtime.ts";

/** Capacitor / 移动原生壳：HTMLAudio MSE 对 audio/mpeg 不可靠 */
export function isCapacitorLikeSpeechRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const shell = window.satelliteShell;
  if (shell?.isNativeShell && !shell.isElectron) return true;
  return isCapacitorNativePlatform() || isMobileCapacitorShellCandidate();
}
