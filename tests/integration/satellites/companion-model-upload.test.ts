import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleModelUpload } from "../../../satellites/companion/server/models.ts";
import { loadConfig } from "../../../satellites/companion/server/config.ts";
import { companionModelsDir } from "../../../satellites/companion/server/paths.ts";
import { serveStatic } from "../../../satellites/companion/server/static.ts";

describe("companion model upload", () => {
  let prevHome: string | undefined;
  let home: string;

  beforeEach(() => {
    prevHome = process.env.FREEANIMA_HOME;
    home = mkdtempSync(join(tmpdir(), "companion-upload-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    rmSync(home, { recursive: true, force: true });
  });

  it("上传 .vrm 后写入用户目录并更新配置", async () => {
    const body = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
    const file = new File([body], "test-model.vrm", { type: "model/gltf-binary" });
    const form = new FormData();
    form.append("file", file);

    const res = await handleModelUpload(
      new Request("http://127.0.0.1/api/models/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { model_path: string; filename: string };
    expect(json.model_path).toBe("/models/test-model.vrm");
    expect(json.filename).toBe("test-model.vrm");

    const saved = join(companionModelsDir(), "test-model.vrm");
    expect(existsSync(saved)).toBe(true);
    expect(readFileSync(saved)).toEqual(Buffer.from(body));

    const cfg = loadConfig();
    expect(cfg.model_path).toBe("/models/test-model.vrm");
  });

  it("上传后可通过 serveStatic 提供模型文件", async () => {
    const file = new File([new Uint8Array([9, 8, 7])], "serve-me.vrm");
    const form = new FormData();
    form.append("file", file);
    await handleModelUpload(
      new Request("http://127.0.0.1/api/models/upload", { method: "POST", body: form }),
    );

    const res = serveStatic("/models/serve-me.vrm");
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([9, 8, 7]));
  });
});
