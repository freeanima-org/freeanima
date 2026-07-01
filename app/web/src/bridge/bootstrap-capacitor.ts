export async function bootstrapCapacitorBridge(): Promise<void> {
  const { waitForCapacitorBridge } = await import("@freeanima/app-mobile/capacitor-ready");
  const { buildMobileShell, createMobileShellStub, loadHubUrl, loadRemoteAuthToken } =
    await import("@freeanima/app-mobile/mobile-shell");

  await waitForCapacitorBridge();
  window.satelliteShell = createMobileShellStub();
  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (hubUrl) {
    window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken ?? "");
  }
}
