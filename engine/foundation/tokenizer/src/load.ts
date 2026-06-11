import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Tokenizer } from "@huggingface/tokenizers";

import { hubResolveUrl, repoToCacheDir } from "./paths.ts";

export type TokenizerInstance = {
  repo: string;
  encode: (text: string) => number[];
};

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed ${url}: ${res.status}`);
  }
  const body = await res.text();
  writeFileSync(dest, body, "utf-8");
}

export async function ensureTokenizerFilesOnDisk(repo: string): Promise<void> {
  const dir = repoToCacheDir(repo);
  mkdirSync(dir, { recursive: true });

  const tokenizerPath = `${dir}/tokenizer.json`;
  const configPath = `${dir}/tokenizer_config.json`;

  if (!existsSync(tokenizerPath)) {
    await downloadFile(hubResolveUrl(repo, "tokenizer.json"), tokenizerPath);
  }
  if (!existsSync(configPath)) {
    await downloadFile(hubResolveUrl(repo, "tokenizer_config.json"), configPath);
  }
}

export async function loadTokenizerFromRepo(repo: string): Promise<TokenizerInstance> {
  await ensureTokenizerFilesOnDisk(repo);
  const dir = repoToCacheDir(repo);
  const tokenizerJson = JSON.parse(readFileSync(`${dir}/tokenizer.json`, "utf-8")) as unknown;
  const tokenizerConfig = JSON.parse(
    readFileSync(`${dir}/tokenizer_config.json`, "utf-8"),
  ) as unknown;
  const tokenizer = new Tokenizer(tokenizerJson as object, tokenizerConfig as object);
  return {
    repo,
    encode(text: string): number[] {
      const trimmed = text.trim();
      if (!trimmed) return [];
      return tokenizer.encode(trimmed).ids;
    },
  };
}

export function createTokenizerFromEncode(
  repo: string,
  encode: (text: string) => number[],
): TokenizerInstance {
  return { repo, encode };
}
