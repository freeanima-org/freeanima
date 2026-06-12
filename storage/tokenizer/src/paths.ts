import { homedir } from "node:os";
import { join } from "node:path";

/** Overridable via FREEANIMA_HOME (test isolation). */
export function getAnimaHomeDir(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

export function getTokenizersRootDir(): string {
  return join(getAnimaHomeDir(), "tokenizers");
}

export function getRegistryPath(): string {
  return join(getTokenizersRootDir(), "registry.json");
}

/** Local cache dir for a Hub repo id (org/name). */
export function repoToCacheDir(repo: string): string {
  const [org, name] = repo.split("/");
  if (!org || !name) {
    throw new Error(`invalid tokenizer repo: ${repo}`);
  }
  return join(getTokenizersRootDir(), org, name);
}

export function hubResolveUrl(repo: string, filename: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${filename}`;
}
