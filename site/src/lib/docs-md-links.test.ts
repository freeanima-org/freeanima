import { describe, expect, test } from "bun:test";
import path from "node:path";

import { resolveDocsMdHref } from "./docs-md-links.ts";

/** path.resolve 保证 Windows 带盘符，与生产侧 normalizeFsPath 前缀比较一致 */
const docsRoot = path.resolve("/repo/docs");
const options = { docsRoot };

describe("resolveDocsMdHref", () => {
  test("same-directory link", () => {
    expect(resolveDocsMdHref("self-layer.md", `${docsRoot}/cognition/memory.md`, options)).toBe(
      "/docs/cognition/self-layer/",
    );
  });

  test("parent-relative link with hash", () => {
    expect(
      resolveDocsMdHref(
        "../ops/security.md#credential-responsibilities",
        `${docsRoot}/product/architecture.md`,
        options,
      ),
    ).toBe("/docs/ops/security/#credential-responsibilities");
  });

  test("readme overview link", () => {
    expect(resolveDocsMdHref("ops/security.md", `${docsRoot}/README.md`, options)).toBe(
      "/docs/ops/security/",
    );
  });

  test("skips external and out-of-docs links", () => {
    const source = `${docsRoot}/README.md`;
    expect(resolveDocsMdHref("https://example.com/a.md", source, options)).toBeNull();
    expect(
      resolveDocsMdHref(path.join("..", ".agent", "rules", "README.md"), source, options),
    ).toBeNull();
  });
});
