import type { Plugin } from "unified";

import { resolveDocsMdHref, type DocsMdLinksOptions } from "../lib/docs-md-links.ts";

type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
};

type HastRoot = {
  type: "root";
  children: HastNode[];
};

type HastNode = HastRoot | HastElement | { type: string; children?: HastNode[] };

function visitElements(node: HastNode, visit: (element: HastElement) => void): void {
  if (node.type === "root") {
    for (const child of node.children) {
      if (child.type === "element") {
        visitElements(child, visit);
      }
    }
    return;
  }
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
export function rehypeDocsMdLinks(options: DocsMdLinksOptions): Plugin<[], HastRoot> {
  return (tree: HastRoot, file: { path?: string | null | undefined }) => {
    const filePath = typeof file.path === "string" ? file.path : undefined;
    if (!filePath) {
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

      const resolved = resolveDocsMdHref(href, filePath, options);
      if (resolved) {
        node.properties = { ...node.properties, href: resolved };
      }
    });
  };
}
