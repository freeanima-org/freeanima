#!/usr/bin/env bun
/**
 * 将 monorepo 版本 / channel 身份同步到 Android（versionName、versionCode、applicationId、显示名）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { computeAndroidVersionCode } from "@freeanima/core/config/android-version-code.ts";
import { resolveBuildChannelFromEnv } from "@freeanima/core/config/build-meta.ts";
import { resolveBuildVersionFromEnv } from "@freeanima/core/config/resolve-build-version.ts";
import { getRepoRoot } from "@freeanima/core/config/repo-root.ts";
import { resolveMobileShellIdentity } from "@freeanima/core/config/shell-identity.ts";

const ROOT = getRepoRoot();
const gradlePath = join(ROOT, "src/app/shell/mobile/android/app/build.gradle");
const stringsPath = join(ROOT, "src/app/shell/mobile/android/app/src/main/res/values/strings.xml");
const capacitorConfigPath = join(ROOT, "src/app/shell/mobile/capacitor.config.json");

const channel = resolveBuildChannelFromEnv("dev");
const version = resolveBuildVersionFromEnv(ROOT);
const identity = resolveMobileShellIdentity(channel);
const versionCode = computeAndroidVersionCode(version, { channel });

let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/applicationId\s+"[^"]*"/, `applicationId "${identity.applicationId}"`);
writeFileSync(gradlePath, gradle);

let strings = readFileSync(stringsPath, "utf8");
strings = strings.replace(
  /<string name="app_name">[^<]*<\/string>/,
  `<string name="app_name">${identity.appName}</string>`,
);
strings = strings.replace(
  /<string name="title_activity_main">[^<]*<\/string>/,
  `<string name="title_activity_main">${identity.appName}</string>`,
);
strings = strings.replace(
  /<string name="package_name">[^<]*<\/string>/,
  `<string name="package_name">${identity.applicationId}</string>`,
);
strings = strings.replace(
  /<string name="custom_url_scheme">[^<]*<\/string>/,
  `<string name="custom_url_scheme">${identity.applicationId}</string>`,
);
writeFileSync(stringsPath, strings);

const cap = JSON.parse(readFileSync(capacitorConfigPath, "utf8")) as {
  appId?: string;
  appName?: string;
  [key: string]: unknown;
};
cap.appId = identity.applicationId;
cap.appName = identity.appName;
writeFileSync(capacitorConfigPath, `${JSON.stringify(cap, null, 2)}\n`);

console.log(
  `synced Android versionName=${version} versionCode=${versionCode} applicationId=${identity.applicationId} channel=${channel}`,
);
