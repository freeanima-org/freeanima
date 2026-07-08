export async function bootstrapCapacitorBridge(): Promise<void> {
  const { waitForCapacitorBridge } = await import("@freeanima/app-mobile/capacitor-ready");
  const {
    attachNativeBuild,
    buildMobileShell,
    createMobileShellStub,
    loadHubUrl,
    loadRemoteAuthToken,
  } = await import("@freeanima/app-mobile/mobile-shell");
  const { loadMobileNativeBuildMeta } =
    await import("@freeanima/app-mobile/native-build-meta-prefs");

  await waitForCapacitorBridge();
  const nativeBuild = await loadMobileNativeBuildMeta();
  window.satelliteShell = attachNativeBuild(createMobileShellStub(), nativeBuild);
  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (hubUrl) {
    window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken ?? "");
  }
}
