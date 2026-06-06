export type StudioConfig = {
  workspace: string;
  gitignore: boolean;
  showHidden: boolean;
};

export type StudioSearchHit = {
  file: string;
  line: number;
  column: number;
  content: string;
  match: string;
};

let getStudioConfigImpl: (() => StudioConfig) | null = null;
let patchStudioConfigImpl: ((patch: Partial<StudioConfig>) => StudioConfig) | null = null;
let buildFileTreeImpl: (() => unknown) | null = null;
let readStudioFileImpl: ((relPath: string) => unknown) | null = null;
let searchStudioImpl: ((query: string) => { results: StudioSearchHit[] }) | null = null;
let resolveWorkspaceImpl: (() => string) | null = null;

export function registerStudioPort(port: {
  getStudioConfig: () => StudioConfig;
  patchStudioConfig: (patch: Partial<StudioConfig>) => StudioConfig;
  buildFileTree: () => unknown;
  readStudioFile: (relPath: string) => unknown;
  searchStudio: (query: string) => { results: StudioSearchHit[] };
  resolveWorkspace: () => string;
}): void {
  getStudioConfigImpl = port.getStudioConfig;
  patchStudioConfigImpl = port.patchStudioConfig;
  buildFileTreeImpl = port.buildFileTree;
  readStudioFileImpl = port.readStudioFile;
  searchStudioImpl = port.searchStudio;
  resolveWorkspaceImpl = port.resolveWorkspace;
}

export function unregisterStudioPort(): void {
  getStudioConfigImpl = null;
  patchStudioConfigImpl = null;
  buildFileTreeImpl = null;
  readStudioFileImpl = null;
  searchStudioImpl = null;
  resolveWorkspaceImpl = null;
}

function assertRegistered<T>(impl: T | null, name: string): T {
  if (!impl) throw new Error(`${name} 未注册：请先加载 @freeanima/service`);
  return impl;
}

export function getStudioConfig(): StudioConfig {
  return assertRegistered(getStudioConfigImpl, "getStudioConfig")();
}

export function patchStudioConfig(patch: Partial<StudioConfig>): StudioConfig {
  return assertRegistered(patchStudioConfigImpl, "patchStudioConfig")(patch);
}

export function buildFileTree(): unknown {
  return assertRegistered(buildFileTreeImpl, "buildFileTree")();
}

export function readStudioFile(relPath: string): unknown {
  return assertRegistered(readStudioFileImpl, "readStudioFile")(relPath);
}

export function searchStudio(query: string): { results: StudioSearchHit[] } {
  return assertRegistered(searchStudioImpl, "searchStudio")(query);
}

export function resolveWorkspace(): string {
  return assertRegistered(resolveWorkspaceImpl, "resolveWorkspace")();
}
