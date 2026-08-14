#!/usr/bin/env bun
/**
 * 解析 canary 版本串：`{nextVersion}-canary+{UTC YYYYMMDDHHmm}`
 *
 * nextVersion：
 * 1. 有 open Release PR（label `autorelease: pending`）→ 读 PR head 的 package.json.version
 * 2. 否则回退 `.release-please-manifest.json` 已发布版
 *
 * 用法：bun scripts/resolve-canary-version.ts
 * 输出：仅一行版本串到 stdout；也可用 --github-output 写入 GITHUB_OUTPUT
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getRepoRoot } from "@freeanima/habitat/core/config/repo-root.ts";
import { formatCanaryVersion } from "@freeanima/habitat/core/config/canary-version.ts";

const ROOT = getRepoRoot();

function readManifestVersion(): string {
  const raw = JSON.parse(readFileSync(join(ROOT, ".release-please-manifest.json"), "utf8")) as {
    "."?: string;
  };
  const v = raw["."]?.trim();
  if (!v) throw new Error(".release-please-manifest.json missing '.' version");
  return v;
}

async function fetchReleasePrPackageVersion(): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repo) return null;

  const listUrl = `https://api.github.com/repos/${repo}/pulls?state=open&per_page=30`;
  const listRes = await fetch(listUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "freeanima-resolve-canary-version",
    },
  });
  if (!listRes.ok) {
    console.error(`[resolve-canary-version] list PRs failed: ${listRes.status}`);
    return null;
  }
  const prs = (await listRes.json()) as Array<{
    title?: string;
    labels?: Array<{ name?: string }>;
    head?: { sha?: string; ref?: string };
  }>;
  const pending = prs.find((p) => (p.labels ?? []).some((l) => l.name === "autorelease: pending"));
  if (!pending?.head?.sha) return null;

  // 标题 chore: release X.Y.Z 可作兜底
  const titleVer = pending.title?.match(/^chore:\s*release\s+(\d+\.\d+\.\d+)/i)?.[1];

  const contentsUrl = `https://api.github.com/repos/${repo}/contents/package.json?ref=${encodeURIComponent(pending.head.sha)}`;
  const pkgRes = await fetch(contentsUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "freeanima-resolve-canary-version",
    },
  });
  if (!pkgRes.ok) {
    if (titleVer) return titleVer;
    console.error(`[resolve-canary-version] fetch package.json failed: ${pkgRes.status}`);
    return null;
  }
  const body = (await pkgRes.json()) as { content?: string; encoding?: string };
  if (body.encoding === "base64" && body.content) {
    const pkg = JSON.parse(Buffer.from(body.content, "base64").toString("utf8")) as {
      version?: string;
    };
    const v = pkg.version?.trim();
    if (v) return v.replace(/^v/i, "");
  }
  return titleVer ?? null;
}

export async function resolveCanaryVersion(opts?: { now?: Date }): Promise<{
  version: string;
  nextVersion: string;
  source: "release-pr" | "manifest";
}> {
  const fromPr = await fetchReleasePrPackageVersion();
  const nextVersion = fromPr ?? readManifestVersion();
  const source = fromPr ? "release-pr" : "manifest";
  return {
    nextVersion,
    source,
    version: formatCanaryVersion(nextVersion, opts?.now),
  };
}

async function main(): Promise<void> {
  const writeGithubOutput = process.argv.includes("--github-output");
  const resolved = await resolveCanaryVersion();
  console.error(
    `[resolve-canary-version] next=${resolved.nextVersion} source=${resolved.source} → ${resolved.version}`,
  );
  console.log(resolved.version);
  if (writeGithubOutput) {
    const out = process.env.GITHUB_OUTPUT;
    if (!out) throw new Error("--github-output requires GITHUB_OUTPUT");
    const { appendFileSync } = await import("node:fs");
    appendFileSync(out, `version=${resolved.version}\n`);
    appendFileSync(out, `next_version=${resolved.nextVersion}\n`);
    appendFileSync(out, `source=${resolved.source}\n`);
  }
}

if (import.meta.main) {
  await main();
}
