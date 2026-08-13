import { parseComponentBuildMeta, type ComponentBuildMeta } from "./build-meta.ts";

/** 从 esbuild/Vite define 注入的 native build 元数据读取（浏览器安全） */
export function readNativeBuildMetaFromDefine(raw: unknown): ComponentBuildMeta | undefined {
  const parsed = parseComponentBuildMeta(raw);
  return parsed?.component === "native" ? parsed : undefined;
}

/** prepare-tauri 写入 index.html 的内联元数据（不依赖 asset fetch） */
export function readInlineNativeBuildMeta(): ComponentBuildMeta | undefined {
  if (typeof window === "undefined") return undefined;
  return readNativeBuildMetaFromDefine(
    (window as Window & { __FREEANIMA_NATIVE_BUILD_META__?: unknown })
      .__FREEANIMA_NATIVE_BUILD_META__,
  );
}

/** Tauri：内联优先，再试多条 asset URL（WebView 对绝对路径偶发 404） */
export async function loadTauriNativeBuildMetaFromAssets(): Promise<
  ComponentBuildMeta | undefined
> {
  const inline = readInlineNativeBuildMeta();
  if (inline) return inline;

  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/web/";
  const candidates = [
    `${base}native-build-meta.json`.replace(/\/{2,}/g, "/"),
    "/web/native-build-meta.json",
  ];
  if (typeof document !== "undefined" && document.baseURI) {
    try {
      candidates.push(new URL("native-build-meta.json", document.baseURI).href);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    try {
      candidates.push(new URL("native-build-meta.json", window.location.href).href);
    } catch {
      /* ignore */
    }
  }

  const seen = new Set<string>();
  for (const url of candidates) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const meta = readNativeBuildMetaFromDefine(await res.json());
      if (meta) return meta;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
