import { describe, expect, test } from "bun:test";

import { languageFromPath } from "./code-language.ts";

describe("languageFromPath", () => {
  test("常见扩展", () => {
    expect(languageFromPath("a/b/foo.tsx")).toBe("tsx");
    expect(languageFromPath("Cargo.toml")).toBe("toml");
    expect(languageFromPath("x.unknownext")).toBe("plaintext");
  });

  test("特殊文件名", () => {
    expect(languageFromPath("Dockerfile")).toBe("dockerfile");
    expect(languageFromPath("Justfile")).toBe("bash");
  });
});
