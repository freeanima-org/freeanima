import { describe, expect, it } from "bun:test";
import { handleModelUpload } from "./models.ts";
import { serveStatic } from "./static.ts";

describe("companion model upload", () => {
  it("本地 upload API 已停用，引导经 Habitat companion.model.upload", async () => {
    const body = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
    const file = new File([body], "test-model.vrm", { type: "model/gltf-binary" });
    const form = new FormData();
    form.append("file", file);

    const res = await handleModelUpload(
      new Request("http://127.0.0.1/api/models/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Habitat companion.model.upload");
  });

  it("serveStatic 对非法 pathname 返回 404 JSON（不抛）", () => {
    const res = serveStatic("/models/missing.vrm");
    expect(res.status).toBe(404);
  });
});
