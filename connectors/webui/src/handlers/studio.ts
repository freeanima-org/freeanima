import {
  buildFileTree,
  getStudioConfig,
  patchStudioConfig,
  readStudioFile,
  searchStudio,
} from "@freeanima/legacy-runtime";
import { studioConfigPatchSchema, studioSearchBodySchema } from "@freeanima/legacy-api";
import { ApiHandlerError } from "./errors.ts";

export function studioGetConfig() {
  return getStudioConfig();
}

export function studioPatchConfig(body: unknown) {
  const parsed = studioConfigPatchSchema.parse(body);
  const patch: Record<string, unknown> = {};
  if (parsed.workspace !== undefined) patch.workspace = parsed.workspace;
  if (parsed.gitignore !== undefined) patch.gitignore = parsed.gitignore;
  if (parsed.showHidden !== undefined) patch.showHidden = parsed.showHidden;
  return patchStudioConfig(patch as Parameters<typeof patchStudioConfig>[0]);
}

export function studioGetTree() {
  try {
    return buildFileTree();
  } catch (e) {
    const msg = String(e);
    throw new ApiHandlerError(msg.includes("未配置") ? 400 : 404, msg);
  }
}

export function studioGetFile(path: string) {
  const trimmed = path.trim();
  if (!trimmed) throw new ApiHandlerError(400, "path is required");
  try {
    return readStudioFile(trimmed);
  } catch (e) {
    throw new ApiHandlerError(400, String(e));
  }
}

export function studioSearch(body: unknown) {
  const { query } = studioSearchBodySchema.parse(body);
  try {
    return searchStudio(query);
  } catch (e) {
    const msg = String(e);
    throw new ApiHandlerError(msg.includes("未配置") ? 400 : 500, msg);
  }
}
