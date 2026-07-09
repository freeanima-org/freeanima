export async function bootstrapCapacitorBridge(): Promise<void> {
  const { waitForCapacitorBridge } =
    await import("@freeanima/app/shell/mobile/lib/capacitor-ready.ts");
  const {
    attachNativeBuild,
    buildMobileShell,
    createMobileShellStub,
    loadHubUrl,
    loadRemoteAuthToken,
  } = await import("@freeanima/app/shell/mobile/lib/mobile-shell.ts");
  const { loadMobileNativeBuildMeta, persistNativeBuildMeta } =
    await import("@freeanima/app/shell/mobile/lib/native-build-meta-prefs.ts");
  const { NATIVE_BUILD_META_CHANGED_EVENT } =
    await import("@freeanima/frontend/shell-sdk/native-build-meta.resolve");

  await waitForCapacitorBridge();
  const nativeBuild = await loadMobileNativeBuildMeta();
  if (nativeBuild) {
    await persistNativeBuildMeta(nativeBuild);
  }
  window.satelliteShell = attachNativeBuild(createMobileShellStub(), nativeBuild);
  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (hubUrl) {
    window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken ?? "");
  }
  if (window.satelliteShell?.nativeBuild) {
    window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
  }
}
