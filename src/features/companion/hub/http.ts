import { readFileSync } from "node:fs";
import { Elysia } from "elysia";
import { ApiHandlerError } from "../../console/hub/console-api/handlers/errors.ts";
import { resolveAssetFilePath } from "../domain/client-config.ts";
import { addModelFromUpload } from "../domain/model-registry.ts";
import { importMotionUpload } from "../domain/motion-import.ts";
import { validateVrmUpload } from "../domain/models.ts";

export const companionHttpRoutes = new Elysia({ prefix: "/companion" })
  .post("/models/upload", async ({ request }) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiHandlerError(400, "无效的 multipart 请求");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiHandlerError(400, "缺少 file 字段");
    }
    const validationError = validateVrmUpload(file);
    if (validationError) {
      throw new ApiHandlerError(400, validationError);
    }
    await addModelFromUpload(file);
    return { ok: true as const };
  })
  .post("/motions/import", async ({ request }) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiHandlerError(400, "无效的 multipart 请求");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiHandlerError(400, "缺少 file 字段");
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".zip") && !lower.endsWith(".vrma") && !lower.endsWith(".fbx")) {
      throw new ApiHandlerError(400, "仅支持 .vrma、.fbx 或 .zip");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importMotionUpload(file.name, bytes);
    return { ok: true as const, ...result };
  })
  .get("/assets/:kind/:fileName", ({ params, set }) => {
    const kind = params.kind === "models" || params.kind === "motions" ? params.kind : null;
    if (!kind) {
      throw new ApiHandlerError(400, "无效资产类型");
    }
    const path = resolveAssetFilePath(kind, params.fileName);
    if (!path) {
      throw new ApiHandlerError(404, "资产不存在");
    }
    const bytes = readFileSync(path);
    set.headers["content-type"] = kind === "models" ? "model/vrm" : "application/octet-stream";
    set.headers["cache-control"] = "public, max-age=3600";
    return bytes;
  });
