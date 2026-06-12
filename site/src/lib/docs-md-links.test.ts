import { describe, expect, test } from "bun:test";
import path from "node:path";

import { resolveDocsMdHref } from "./docs-md-links.ts";

const enRoot = "/repo/docs";
const zhRoot = "/repo/docs/.generated/zh_CN";
const options = { enRoot, zhRoot };

describe("resolveDocsMdHref", () => {
  test("same-directory link", () => {
    expect(resolveDocsMdHref("self-layer.md", `${enRoot}/concepts/architecture.md`, options)).toBe(
      "/docs/concepts/self-layer/",
    );
  });

  test("parent-relative link with hash", () => {
    expect(
      resolveDocsMdHref(
        "../guide/security.md#credential-responsibilities",
        `${enRoot}/concepts/architecture.md`,
        options,
      ),
    ).toBe("/docs/guide/security/#credential-responsibilities");
  });

  test("readme overview link", () => {
    expect(resolveDocsMdHref("guide/security.md", `${enRoot}/README.md`, options)).toBe(
      "/docs/guide/security/",
    );
  });

  test("zh-cn locale prefix", () => {
    expect(resolveDocsMdHref("memory.md", `${zhRoot}/concepts/architecture.md`, options)).toBe(
      "/zh-cn/docs/concepts/memory/",
    );
  });

  test("skips external and out-of-docs links", () => {
    const source = `${enRoot}/README.md`;
    expect(resolveDocsMdHref("https://example.com/a.md", source, options)).toBeNull();
    expect(
      resolveDocsMdHref(path.join("..", ".agent", "rules", "README.md"), source, options),
    ).toBeNull();
  });
});
