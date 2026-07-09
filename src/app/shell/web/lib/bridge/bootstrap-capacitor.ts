export async function bootstrapCapacitorBridge(): Promise<void> {
  const { pinCapacitorNativeBridge } =
    await import("@freeanima/app/shell/mobile/lib/capacitor-plugins.ts");
  const { waitForCapacitorBridge } =
    await import("@freeanima/app/shell/mobile/lib/capacitor-ready.ts");
  const {
    attachNativeBuild,
    buildMobileShell,
    createMobileShellStub,
    loadHubUrl,
    loadRemoteAuthToken,
    readShellSnapshot,
  } = await import("@freeanima/app/shell/mobile/lib/mobile-shell.ts");
  const { createMobileScopedBackend, testMobileHubConnection } =
    await import("@freeanima/app/shell/mobile/lib/settings-prefs-backend.ts");
  const { loadMobileNativeBuildMeta, persistNativeBuildMeta } =
    await import("@freeanima/app/shell/mobile/lib/native-build-meta-prefs.ts");
  const { NATIVE_BUILD_META_CHANGED_EVENT } =
    await import("@freeanima/frontend/shell-sdk/native-build-meta.resolve");

  pinCapacitorNativeBridge();
  try {
    await waitForCapacitorBridge();
  } catch (err) {
    console.warn("[shell-bridge] Capacitor nativePromise 未就绪，使用快照回退", err);
  }

  const nativeBuild = await loadMobileNativeBuildMeta();
  if (nativeBuild) {
    await persistNativeBuildMeta(nativeBuild);
  }

  const snapshot = readShellSnapshot();
  let hubUrl = snapshot?.hubUrl ?? null;
  let remoteAuthToken = snapshot?.remoteAuthToken ?? "";
  if (!hubUrl) {
    try {
      hubUrl = await loadHubUrl();
      remoteAuthToken = (await loadRemoteAuthToken()) ?? "";
    } catch {
      /* 远程 Hub 页可能尚无 Preferences 桥，依赖上方快照 */
    }
  }

  window.satelliteShell = attachNativeBuild(createMobileShellStub(), nativeBuild);
  if (hubUrl) {
    window.satelliteShell = await buildMobileShell(hubUrl, remoteAuthToken);
  }
  if (window.satelliteShell) {
    const { attachMobileNativeAlertToShell } =
      await import("@freeanima/app/shell/mobile/lib/mobile-local-alert.ts");
    window.satelliteShell = attachMobileNativeAlertToShell(window.satelliteShell);
  }

  const backend = createMobileScopedBackend();
  window.freeanimaScopedSettings = {
    load: (scope) => backend.load(scope),
    save: async (scope, value) => {
      await backend.save(scope, value);
    },
    test: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "hub") {
        const raw = value as { hubUrl: string; remoteAuthToken: string };
        await testMobileHubConnection(raw);
        return;
      }
      await backend.save(scope, value);
    },
  };

  if (window.satelliteShell?.nativeBuild) {
    window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
  }
}
