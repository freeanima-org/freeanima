import { describe, expect, test } from "bun:test";
import { MAX_VRM_BYTES, sanitizeModelFilename, validateVrmUpload } from "./models.ts";

describe("sanitizeModelFilename", () => {
  test("保留安全字符并强制 .vrm", () => {
    expect(sanitizeModelFilename("my-character.vrm")).toBe("my-character.vrm");
  });

  test("剥离路径并替换非法字符", () => {
    expect(sanitizeModelFilename("../../evil/name (1).vrm")).toBe("name_1.vrm");
  });

  test("空名时使用时间戳前缀", () => {
    expect(sanitizeModelFilename("///.vrm")).toMatch(/^model-\d+\.vrm$/);
  });
});

describe("validateVrmUpload", () => {
  test("接受合法 .vrm", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "a.vrm", { type: "model/gltf-binary" });
    expect(validateVrmUpload(file)).toBeNull();
  });

  test("拒绝非 .vrm 扩展名", () => {
    const file = new File([new Uint8Array([1])], "a.glb");
    expect(validateVrmUpload(file)).toBe("仅支持 .vrm 文件");
  });

  test("拒绝空文件", () => {
    const file = new File([], "a.vrm");
    expect(validateVrmUpload(file)).toBe("文件为空");
  });

  test("拒绝超大文件", () => {
    const file = new File([new Uint8Array(1)], "a.vrm");
    Object.defineProperty(file, "size", { value: MAX_VRM_BYTES + 1 });
    expect(validateVrmUpload(file)).toContain("文件过大");
  });
});
