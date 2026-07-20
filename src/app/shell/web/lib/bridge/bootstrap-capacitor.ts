export async function bootstrapCapacitorBridge(): Promise<void> {
  const { pinCapacitorNativeBridge } =
    await import("@freeanima/app/shell/mobile/lib/capacitor-plugins.ts");
  const { waitForCapacitorBridge } =
    await import("@freeanima/app/shell/mobile/lib/capacitor-ready.ts");
  const {
    attachNativeBuild,
    buildMobileShell,
    createMobileShellStub,
    loadHabitatUrl,
    loadRemoteAuthToken,
    readShellSnapshot,
  } = await import("@freeanima/app/shell/mobile/lib/mobile-shell.ts");
  const { createMobileScopedBackend, testMobileHabitatConnection } =
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
  let habitatUrl = snapshot?.habitatUrl ?? null;
  let remoteAuthToken = snapshot?.remoteAuthToken ?? "";
  if (!habitatUrl) {
    try {
      habitatUrl = await loadHabitatUrl();
      remoteAuthToken = (await loadRemoteAuthToken()) ?? "";
    } catch {
      /* 远程 Habitat 页可能尚无 Preferences 桥，依赖上方快照 */
    }
  }

  window.satelliteShell = attachNativeBuild(createMobileShellStub(), nativeBuild);
  if (habitatUrl) {
    window.satelliteShell = await buildMobileShell(habitatUrl, remoteAuthToken);
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
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        await testMobileHabitatConnection(raw);
        return;
      }
      await backend.save(scope, value);
    },
  };

  if (window.satelliteShell?.nativeBuild) {
    window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
  }
}
