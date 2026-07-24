import { describe, expect, test } from "bun:test";
import path from "node:path";

import { resolveDocsMdHref } from "./docs-md-links.ts";

const enRoot = "/repo/docs";
const zhRoot = "/repo/docs/.generated/zh_CN";
const options = { enRoot, zhRoot };

describe("resolveDocsMdHref", () => {
  test("same-directory link", () => {
    expect(resolveDocsMdHref("self-layer.md", `${enRoot}/cognition/memory.md`, options)).toBe(
      "/docs/cognition/self-layer/",
    );
  });

  test("parent-relative link with hash", () => {
    expect(
      resolveDocsMdHref(
        "../ops/security.md#credential-responsibilities",
        `${enRoot}/product/architecture.md`,
        options,
      ),
    ).toBe("/docs/ops/security/#credential-responsibilities");
  });

  test("readme overview link", () => {
    expect(resolveDocsMdHref("ops/security.md", `${enRoot}/README.md`, options)).toBe(
      "/docs/ops/security/",
    );
  });

  test("zh-cn locale prefix", () => {
    expect(resolveDocsMdHref("memory.md", `${zhRoot}/cognition/architecture.md`, options)).toBe(
      "/zh-cn/docs/cognition/memory/",
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
