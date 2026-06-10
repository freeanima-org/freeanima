import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

export type DocMaster = {
  /** Relative to repo root, e.g. docs/concepts/identity.md */
  rel: string;
  /** Absolute path */
  abs: string;
  /** po4a $master: filename with extension (po4a 0.73) */
  master: string;
};

/** gettext / po4a 语言目录名（如 zh_CN、ja） */
export const DOC_PO_LANGS = ["zh_CN"] as const;
export type DocPoLang = (typeof DOC_PO_LANGS)[number];

const root = join(import.meta.dir, "..");
export const docsRoot = join(root, "docs");
export const poRoot = join(root, "po");
export const potRoot = join(poRoot, "pot");
export const generatedZhRoot = join(root, "docs/.generated/zh_CN");
export const zhRefRoot = join(root, "docs/.zh-cn-ref");

/** po4a $master token: basename including .md */
export function masterFilename(rel: string): string {
  return basename(rel);
}

export function listDocMasters(dir: string = docsRoot): DocMaster[] {
  const out: DocMaster[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).toSorted()) {
    if (dir === docsRoot && (name === ".zh-cn-ref" || name === ".generated")) {
      continue;
    }
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...listDocMasters(path));
    } else if (/\.mdx?$/i.test(name)) {
      const rel = relative(root, path);
      out.push({ rel, abs: path, master: masterFilename(rel) });
    }
  }
  return out;
}

export function poLangDir(lang: DocPoLang): string {
  return join(poRoot, lang);
}

export function poPotPath(master: string): string {
  return join(potRoot, `${master}.pot`);
}

/** 语言 PO：po/<lang>/<master>.po（不含语言后缀） */
export function poFilePath(master: string, lang: DocPoLang = "zh_CN"): string {
  return join(poLangDir(lang), `${master}.po`);
}

export function ensurePoLayout(): void {
  mkdirSync(potRoot, { recursive: true });
  for (const lang of DOC_PO_LANGS) {
    mkdirSync(poLangDir(lang), { recursive: true });
  }
}

export function listPoFilesForLang(lang: DocPoLang): string[] {
  const dir = poLangDir(lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".po"))
    .map((name) => join(dir, name))
    .toSorted();
}

export function assertUniqueMasters(masters: DocMaster[]): void {
  const seen = new Map<string, string>();
  for (const { master, rel } of masters) {
    const prev = seen.get(master);
    if (prev) {
      throw new Error(`duplicate po4a $master "${master}": ${prev} and ${rel}`);
    }
    seen.set(master, rel);
  }
}
