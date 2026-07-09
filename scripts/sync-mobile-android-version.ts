#!/usr/bin/env bun
/** 将 monorepo 版本同步到 Android versionName */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readAppVersion } from "@freeanima/core/config/version.ts";
import { getRepoRoot } from "@freeanima/core/config/repo-root.ts";

const ROOT = getRepoRoot();
const gradlePath = join(ROOT, "src/app/shell/mobile/android/app/build.gradle");
const version = readAppVersion(ROOT);

let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

const parts = version.split(".").map((p) => Number.parseInt(p, 10));
const major = Number.isFinite(parts[0]) ? (parts[0] as number) : 0;
const minor = Number.isFinite(parts[1]) ? (parts[1] as number) : 0;
const patch = Number.isFinite(parts[2]) ? (parts[2] as number) : 0;
const versionCode = major * 10_000 + minor * 100 + patch;
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);

writeFileSync(gradlePath, gradle);
console.log(`synced Android versionName=${version} versionCode=${versionCode}`);
