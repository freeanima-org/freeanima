export type SemverBump = "patch" | "minor" | "major";

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** 解析 MAJOR.MINOR.PATCH；非法输入抛错 */
export function parseSemver(version: string): SemverParts {
  const m = version.trim().match(SEMVER_RE);
  if (!m) {
    throw new Error(`无效的语义化版本: ${version}`);
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

export function formatSemver(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/** bump patch / minor / major */
export function bumpSemver(version: string, kind: SemverBump): string {
  const p = parseSemver(version);
  if (kind === "patch") {
    p.patch += 1;
  } else if (kind === "minor") {
    p.minor += 1;
    p.patch = 0;
  } else {
    p.major += 1;
    p.minor = 0;
    p.patch = 0;
  }
  return formatSemver(p);
}
