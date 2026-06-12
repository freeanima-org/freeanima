import path from "node:path";

export interface DocsMdLinksOptions {
  /** Absolute path to English docs root (`docs/`). */
  enRoot: string;
  /** Absolute path to generated Chinese docs root (`docs/.generated/zh_CN/`). */
  zhRoot: string;
}

function normalizeFsPath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

function docsRelativeToUrl(relativePath: string, localePrefix: "" | "/zh-cn"): string {
  let slug = relativePath.replace(/\.(md|mdx)$/i, "").replace(/\\/g, "/");
  if (/^readme$/i.test(slug) || slug === "") {
    return `${localePrefix}/docs/`;
  }
  slug = slug.replace(/\/readme$/i, "");
  return `${localePrefix}/docs/${slug}/`;
}

/** Resolve a relative `.md` / `.mdx` href from a docs source file to a Starlight URL. */
export function resolveDocsMdHref(
  href: string,
  sourceFilePath: string,
  options: DocsMdLinksOptions,
): string | null {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
    return null;
  }
  if (href.startsWith("#")) {
    return null;
  }

  const hashIndex = href.indexOf("#");
  const pathname = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";

  if (!pathname || !/\.mdx?$/i.test(pathname)) {
    return null;
  }

  const enRoot = normalizeFsPath(options.enRoot);
  const zhRoot = normalizeFsPath(options.zhRoot);
  const sourceDir = path.dirname(normalizeFsPath(sourceFilePath));
  const resolved = normalizeFsPath(path.resolve(sourceDir, pathname));

  let localePrefix: "" | "/zh-cn" = "";
  let relative: string;

  if (resolved === zhRoot || resolved.startsWith(`${zhRoot}/`)) {
    localePrefix = "/zh-cn";
    relative = resolved === zhRoot ? "" : resolved.slice(zhRoot.length + 1);
  } else if (resolved === enRoot || resolved.startsWith(`${enRoot}/`)) {
    relative = resolved === enRoot ? "" : resolved.slice(enRoot.length + 1);
  } else {
    return null;
  }

  return docsRelativeToUrl(relative, localePrefix) + hash;
}
