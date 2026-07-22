#!/usr/bin/env bun
/**
 * 在 `tauri android init` / gen 之后应用 Android 工程补丁（可重复执行）。
 * - network_security_config：信任用户 CA + 允许 cleartext
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidMain = join(root, "src/app/shell/tauri/src-tauri/gen/android/app/src/main");
const manifestPath = join(androidMain, "AndroidManifest.xml");
const xmlDir = join(androidMain, "res/xml");
const nscPath = join(xmlDir, "network_security_config.xml");

const NSC = `<?xml version="1.0" encoding="utf-8"?>
<!--
  - 信任用户安装的 CA（mkcert rootCA），否则 HTTPS WebView / WebSocket 会失败而原生 HTTP 探测可能仍通。
  - 允许明文 HTTP（局域网 / 裸 IP 调试）。
-->
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

if (!existsSync(manifestPath)) {
  console.error(
    `[patch-tauri-android] 缺少 ${manifestPath}，请先：just install-android-tauri -- --init`,
  );
  process.exit(1);
}

mkdirSync(xmlDir, { recursive: true });
writeFileSync(nscPath, NSC, "utf-8");

let manifest = readFileSync(manifestPath, "utf-8");
if (!manifest.includes("networkSecurityConfig")) {
  manifest = manifest.replace(
    /android:usesCleartextTraffic="\$\{usesCleartextTraffic\}"/,
    `android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="true"`,
  );
  if (!manifest.includes("networkSecurityConfig")) {
    manifest = manifest.replace(
      /(<application\b[^>]*?)(\s*>)/,
      `$1
        android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="true"$2`,
    );
  }
  writeFileSync(manifestPath, manifest, "utf-8");
  console.log("[patch-tauri-android] 已写入 networkSecurityConfig");
} else {
  console.log("[patch-tauri-android] Manifest 已含 networkSecurityConfig");
}
console.log(`[patch-tauri-android] ${nscPath}`);
