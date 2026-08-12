import path from "node:path";

export interface DocsMdLinksOptions {
  /** Absolute path to docs root (`docs/`). */
  docsRoot: string;
}

function normalizeFsPath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

function docsRelativeToUrl(relativePath: string): string {
  let slug = relativePath.replace(/\.(md|mdx)$/i, "").replace(/\\/g, "/");
  if (/^readme$/i.test(slug) || slug === "") {
    return "/docs/";
  }
  slug = slug.replace(/\/readme$/i, "");
  return `/docs/${slug}/`;
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

  const docsRoot = normalizeFsPath(options.docsRoot);
  const sourceDir = path.dirname(normalizeFsPath(sourceFilePath));
  const resolved = normalizeFsPath(path.resolve(sourceDir, pathname));

  if (resolved !== docsRoot && !resolved.startsWith(`${docsRoot}/`)) {
    return null;
  }

  const relative = resolved === docsRoot ? "" : resolved.slice(docsRoot.length + 1);
  return docsRelativeToUrl(relative) + hash;
}
