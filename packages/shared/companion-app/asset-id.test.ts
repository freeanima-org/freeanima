import { describe, expect, test } from "bun:test";
import {
  displayNameFromFilename,
  modelPathForId,
  motionFileNameForId,
  motionPathForId,
  newModelId,
  newMotionId,
} from "./asset-id.ts";

describe("asset-id", () => {
  test("生成带前缀的字母数字 id", () => {
    expect(newMotionId()).toMatch(/^mot_[0-9A-Za-z]{21}$/);
    expect(newModelId()).toMatch(/^mdl_[0-9A-Za-z]{21}$/);
  });

  test("由 id 推导磁盘路径", () => {
    const id = "mot_00000000-0000-4000-8000-000000000001";
    expect(motionFileNameForId(id)).toBe(`${id}.vrma`);
    expect(motionPathForId(id)).toBe(`/motions/${id}.vrma`);
    expect(modelPathForId("mdl_x")).toBe("/models/mdl_x.vrm");
  });

  test("displayNameFromFilename 去掉扩展名", () => {
    expect(displayNameFromFilename("Happy Walk.vrma")).toBe("Happy Walk");
    expect(displayNameFromFilename("/tmp/foo/bar.vrma")).toBe("bar");
  });
});
