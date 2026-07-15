import { registerPlugin } from "@capacitor/core";

type ApkInstallerPlugin = {
  installFromUrl(options: { url: string }): Promise<{ ok: boolean }>;
};

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export async function installApkFromUrl(url: string): Promise<void> {
  await ApkInstaller.installFromUrl({ url });
}
