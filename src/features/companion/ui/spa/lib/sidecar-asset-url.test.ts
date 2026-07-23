import { describe, expect, test } from "bun:test";
import { encodeSidecarPath } from "./sidecar-asset-url.ts";

describe("encodeSidecarPath", () => {
  test("编码含空格的文件名", () => {
    expect(encodeSidecarPath("/motions/my motion.vrma")).toBe("/motions/my%20motion.vrma");
  });

  test("保留已有 query", () => {
    expect(encodeSidecarPath("/motions/a.vrma?v=1")).toBe("/motions/a.vrma?v=1");
  });

  test("不重复编码 http URL", () => {
    const url = "https://example.com/a b.vrma";
    expect(encodeSidecarPath(url)).toBe(url);
  });
});
