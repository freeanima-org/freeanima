/** jsDelivr 上的 vconsole UMD（不打进 Vite 包，mobile debug 按需拉 CDN） */
const VCONSOLE_CDN =
  process.env.FREEANIMA_VCONSOLE_CDN?.trim() ||
  "https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js";

type VConsoleLike = { destroy: () => void };
type VConsoleCtor = new () => VConsoleLike;

let vConsoleInstance: VConsoleLike | null = null;
let loadScriptPromise: Promise<VConsoleCtor> | null = null;

declare global {
  interface Window {
    VConsole?: VConsoleCtor;
  }
}

function loadVConsoleCtor(): Promise<VConsoleCtor> {
  if (typeof window !== "undefined" && window.VConsole) {
    return Promise.resolve(window.VConsole);
  }
  if (loadScriptPromise) return loadScriptPromise;

  loadScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-freeanima-vconsole="1"]`,
    );
    if (existing) {
      existing.addEventListener(
        "load",
        () => {
          if (window.VConsole) resolve(window.VConsole);
          else reject(new Error("vconsole CDN loaded but window.VConsole missing"));
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${VCONSOLE_CDN}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = VCONSOLE_CDN;
    script.async = true;
    script.dataset.freeanimaVconsole = "1";
    script.addEventListener(
      "load",
      () => {
        if (window.VConsole) resolve(window.VConsole);
        else reject(new Error("vconsole CDN loaded but window.VConsole missing"));
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${VCONSOLE_CDN}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return loadScriptPromise;
}

export async function enableMobileDebugConsole(): Promise<void> {
  if (vConsoleInstance) return;
  const VConsole = await loadVConsoleCtor();
  vConsoleInstance = new VConsole();
}

export function disableMobileDebugConsole(): void {
  vConsoleInstance?.destroy();
  vConsoleInstance = null;
}

export function isNativeDebugConsoleEnabled(): boolean {
  return vConsoleInstance != null;
}

export async function applyMobileDebugConsole(enabled: boolean): Promise<void> {
  if (enabled) await enableMobileDebugConsole();
  else disableMobileDebugConsole();
}
