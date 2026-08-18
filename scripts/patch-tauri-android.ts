#!/usr/bin/env bun
/**
 * 在 `tauri android init` / gen 之后应用 Android 工程补丁（可重复执行）。
 * - network_security_config：信任用户 CA + 允许 cleartext
 * - APK 覆盖安装：FileProvider + ApkInstallerPlugin + REQUEST_INSTALL_PACKAGES
 * - blob 保存到下载目录：BlobSaverPlugin + WRITE_EXTERNAL_STORAGE(maxSdk 28)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTauriAndroidMain } from "./tauri-android-gen-paths.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidMain = resolveTauriAndroidMain(root);
if (!androidMain) {
  console.error(
    "[patch-tauri-android] 缺少 gen/android/*/src/main/AndroidManifest.xml，请先：just install tauri-android -- --init",
  );
  process.exit(1);
}
const manifestPath = join(androidMain, "AndroidManifest.xml");
const xmlDir = join(androidMain, "res/xml");
const nscPath = join(xmlDir, "network_security_config.xml");
const pluginSrcDir = join(root, "packages/frontend/portal/app/tauri/android-plugins/apk-installer");
const blobSaverSrcDir = join(root, "packages/frontend/portal/app/tauri/android-plugins/blob-saver");
const pluginKtDest = join(androidMain, "java/com/freeanima/portal/apk/ApkInstallerPlugin.kt");
const blobSaverKtDest = join(androidMain, "java/com/freeanima/portal/blob/BlobSaverPlugin.kt");
const filePathsDest = join(xmlDir, "file_paths.xml");

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

mkdirSync(xmlDir, { recursive: true });
writeFileSync(nscPath, NSC, "utf-8");

const pluginKt = join(pluginSrcDir, "ApkInstallerPlugin.kt");
const filePathsSrc = join(pluginSrcDir, "file_paths.xml");
if (!existsSync(pluginKt) || !existsSync(filePathsSrc)) {
  console.error(`[patch-tauri-android] 缺少 APK 插件源：${pluginSrcDir}`);
  process.exit(1);
}
mkdirSync(dirname(pluginKtDest), { recursive: true });
cpSync(pluginKt, pluginKtDest);
cpSync(filePathsSrc, filePathsDest);
console.log(`[patch-tauri-android] ApkInstallerPlugin → ${pluginKtDest}`);

const blobSaverKt = join(blobSaverSrcDir, "BlobSaverPlugin.kt");
if (!existsSync(blobSaverKt)) {
  console.error(`[patch-tauri-android] 缺少 blob-saver 插件源：${blobSaverSrcDir}`);
  process.exit(1);
}
mkdirSync(dirname(blobSaverKtDest), { recursive: true });
cpSync(blobSaverKt, blobSaverKtDest);
console.log(`[patch-tauri-android] BlobSaverPlugin → ${blobSaverKtDest}`);

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
  console.log("[patch-tauri-android] 已写入 networkSecurityConfig");
} else {
  console.log("[patch-tauri-android] Manifest 已含 networkSecurityConfig");
}

if (!manifest.includes("REQUEST_INSTALL_PACKAGES")) {
  if (manifest.includes("<uses-permission")) {
    manifest = manifest.replace(
      /(<uses-permission\b[^/]*\/>)/,
      `$1\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`,
    );
  } else {
    manifest = manifest.replace(
      /(<manifest\b[^>]*>)/,
      `$1\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`,
    );
  }
  console.log("[patch-tauri-android] 已添加 REQUEST_INSTALL_PACKAGES");
}

if (!manifest.includes("WRITE_EXTERNAL_STORAGE")) {
  if (manifest.includes("<uses-permission")) {
    manifest = manifest.replace(
      /(<uses-permission\b[^/]*\/>)/,
      `$1\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />`,
    );
  } else {
    manifest = manifest.replace(
      /(<manifest\b[^>]*>)/,
      `$1\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />`,
    );
  }
  console.log("[patch-tauri-android] 已添加 WRITE_EXTERNAL_STORAGE (maxSdk 28)");
}

if (!manifest.includes(".fileprovider")) {
  const provider = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>`;
  if (!manifest.includes("</application>")) {
    console.error("[patch-tauri-android] Manifest 缺少 </application>");
    process.exit(1);
  }
  manifest = manifest.replace("</application>", `${provider}\n    </application>`);
  console.log("[patch-tauri-android] 已添加 FileProvider");
}

writeFileSync(manifestPath, manifest, "utf-8");
console.log(`[patch-tauri-android] ${nscPath}`);
console.log(`[patch-tauri-android] ${filePathsDest}`);
