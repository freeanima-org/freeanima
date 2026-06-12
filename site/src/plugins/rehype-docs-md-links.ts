import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import type { VFile } from "vfile";

import { resolveDocsMdHref, type DocsMdLinksOptions } from "../lib/docs-md-links.ts";

function visitElements(node: Root | Element, visit: (element: Element) => void): void {
  if (node.type !== "element") {
    return;
  }
  visit(node);
  for (const child of node.children) {
    if (child.type === "element") {
      visitElements(child, visit);
    }
  }
}

/** Rehype plugin: rewrite in-repo docs `.md` links to Starlight doc URLs. */
export function rehypeDocsMdLinks(options: DocsMdLinksOptions): Plugin<[], Root> {
  return () => (tree: Root, file: VFile) => {
    if (!file.path) {
      return;
    }

    visitElements(tree, (node) => {
      if (node.tagName !== "a") {
        return;
      }

      const href = node.properties?.href;
      if (typeof href !== "string") {
        return;
      }

      const resolved = resolveDocsMdHref(href, file.path, options);
      if (resolved) {
        node.properties.href = resolved;
      }
    });
  };
}
