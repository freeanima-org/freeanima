/** 移动 WebView：HTMLAudio MSE 对 audio/mpeg 不可靠 */
export function isMobileWebViewSpeechRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const shell = window.satelliteShell;
  if (shell?.primaryInput === "touch") return true;
  // bootstrap 未设 primaryInput 时：原生壳默认按移动 WebView 处理
  if (shell?.isNativeShell && shell.primaryInput !== "pointer") return true;
  return false;
}
