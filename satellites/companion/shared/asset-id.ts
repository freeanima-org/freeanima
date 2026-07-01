function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** 导入素材的稳定 ID 与磁盘路径（显示名称单独存 config，改 name 不影响文件） */

export function newModelId(): string {
  return `mdl_${randomUuid()}`;
}

export function newMotionId(): string {
  return `mot_${randomUuid()}`;
}

export function motionFileNameForId(id: string): string {
  return `${id}.vrma`;
}

export function motionPathForId(id: string): string {
  return `/motions/${motionFileNameForId(id)}`;
}

export function modelFileNameForId(id: string): string {
  return `${id}.vrm`;
}

export function modelPathForId(id: string): string {
  return `/models/${modelFileNameForId(id)}`;
}

/** 从上传文件名推导默认显示名（不含扩展名） */
export function displayNameFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const stem = base.replace(/\.[^.]+$/i, "").trim();
  return stem.length > 0 ? stem : "未命名";
}

export function isIdBasedMotionFile(id: string, file: string): boolean {
  return file === motionFileNameForId(id);
}

export function isIdBasedModelPath(id: string, path: string): boolean {
  return path === modelPathForId(id);
}
