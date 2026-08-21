const STORAGE_KEY = "freeanima.color-theme";
const DOM_ATTR = "data-color-theme";

export type ColorThemeId = "neutral" | "ocean" | "forest" | "sunset" | "violet";

export const COLOR_THEME_IDS: ColorThemeId[] = ["neutral", "ocean", "forest", "sunset", "violet"];

export const DEFAULT_COLOR_THEME: ColorThemeId = "neutral";

/** 设置面板色块预览用（与 globals.css 强调色大致对应） */
export const COLOR_THEME_SWATCH: Record<ColorThemeId, string> = {
  neutral: "oklch(0.7 0 0)",
  ocean: "oklch(0.65 0.16 230)",
  forest: "oklch(0.66 0.16 155)",
  sunset: "oklch(0.72 0.16 55)",
  violet: "oklch(0.65 0.18 300)",
};

type ColorThemeListener = () => void;
const listeners = new Set<ColorThemeListener>();

let memoryFallback: ColorThemeId | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function isColorThemeId(value: unknown): value is ColorThemeId {
  return typeof value === "string" && (COLOR_THEME_IDS as readonly string[]).includes(value);
}

export function parseColorTheme(raw: string | null): ColorThemeId {
  if (!raw) return DEFAULT_COLOR_THEME;
  return isColorThemeId(raw) ? raw : DEFAULT_COLOR_THEME;
}

export function readColorTheme(): ColorThemeId {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) ?? null;
    if (raw == null && memoryFallback) return memoryFallback;
    return parseColorTheme(raw);
  } catch {
    return memoryFallback ?? DEFAULT_COLOR_THEME;
  }
}

export function applyColorTheme(theme: ColorThemeId = readColorTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === DEFAULT_COLOR_THEME) {
    root.removeAttribute(DOM_ATTR);
  } else {
    root.setAttribute(DOM_ATTR, theme);
  }
}

export function writeColorTheme(theme: ColorThemeId): void {
  const next = isColorThemeId(theme) ? theme : DEFAULT_COLOR_THEME;
  try {
    const store = storage();
    if (store) {
      if (next === DEFAULT_COLOR_THEME) {
        store.removeItem(STORAGE_KEY);
      } else {
        store.setItem(STORAGE_KEY, next);
      }
    } else {
      memoryFallback = next;
    }
  } catch {
    memoryFallback = next;
  }
  applyColorTheme(next);
  for (const listener of listeners) listener();
}

export function subscribeColorTheme(listener: ColorThemeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetColorThemeForTest(): void {
  memoryFallback = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  applyColorTheme(DEFAULT_COLOR_THEME);
}
