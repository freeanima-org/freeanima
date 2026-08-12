import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@freeanima/ui-kit";
import type { ComponentBuildMeta } from "@freeanima/client/portal-sdk/build-meta";
import { resolveHabitatApiOrigin } from "@freeanima/client/portal-sdk/habitat-api-origin";
import { habitatHealthProbeUrl } from "@freeanima/shared/habitat-rpc";
import {
  isSwitchableChannel,
  otherUpdateTrack,
  resolveNativePackagedKind,
  type UpdateTrack,
} from "@freeanima/client/portal-sdk/app-update";
import { parseComponentBuildMeta } from "@freeanima/client/portal-sdk/build-meta";
import {
  GITHUB_RELEASE_PROXY_IDS,
  type GithubReleaseProxyId,
} from "@freeanima/client/portal-sdk/github-release-proxy";
import {
  readGithubReleaseProxyPref,
  writeGithubReleaseProxyPref,
} from "@freeanima/client/portal-sdk/github-release-proxy-prefs";
import {
  NATIVE_BUILD_META_CHANGED_EVENT,
  resolveAboutNativeBuildMeta,
} from "@freeanima/client/portal-sdk/native-build-meta.resolve";
import { getShellKind, type ShellRuntimeKind } from "@freeanima/client/portal-sdk/shell-runtime.ts";
import { isTauriRuntime } from "@freeanima/client/portal-sdk/tauri-runtime";
import { parseWebUiConfigJson } from "@freeanima/client/portal-sdk/web-ui-config";

import { requestShellUpdateCheck } from "../../ShellUpdateBanner.tsx";

const proxySelectClassName =
  "border-input flex h-8 min-w-[10rem] rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function proxyOptionLabel(id: GithubReleaseProxyId): string {
  switch (id) {
    case "none":
      return "直连（GitHub）";
    case "ghproxy-net":
      return "ghproxy.net";
    case "gh-proxy-com":
      return "gh-proxy.com";
    case "ghfast-top":
      return "ghfast.top";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function formatBuiltAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function BuildMetaRows({
  meta,
  startedAt,
}: {
  meta: ComponentBuildMeta | null | undefined;
  startedAt?: string;
}) {
  if (meta === undefined) {
    return <p className="text-sm text-muted-foreground">{"加载中…"}</p>;
  }
  if (!meta) {
    return <p className="text-sm text-muted-foreground">{"不可用"}</p>;
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "版本", value: meta.version },
    { label: "通道", value: meta.channel },
  ];
  if (meta.component === "native" && meta.shell) {
    const shellValue = getShellKind() === "tauri" ? `${meta.shell} · Tauri` : meta.shell;
    rows.push({ label: "壳", value: shellValue });
  }
  if (meta.git?.commit) {
    rows.push({ label: "提交", value: meta.git.commit });
  }
  if (meta.component === "service" && startedAt) {
    rows.push({
      label: "启动于",
      value: formatBuiltAt(startedAt),
    });
  } else if (meta.built_at) {
    rows.push({
      label: "构建于",
      value: formatBuiltAt(meta.built_at),
    });
  }

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-mono break-all">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BuildMetaGroup({
  title,
  meta,
  loading,
  startedAt,
}: {
  title: string;
  meta: ComponentBuildMeta | null | undefined;
  loading?: boolean;
  startedAt?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <BuildMetaRows meta={loading ? undefined : meta} {...(startedAt ? { startedAt } : {})} />
      </CardContent>
    </Card>
  );
}

type ServiceAboutInfo = {
  meta: ComponentBuildMeta | null;
  startedAt?: string;
};

async function fetchServiceAboutInfo(): Promise<ServiceAboutInfo> {
  try {
    const origin = resolveHabitatApiOrigin();
    const res = await fetch(habitatHealthProbeUrl(origin), { cache: "no-store" });
    if (!res.ok) return { meta: null };
    const body = (await res.json()) as {
      build?: unknown;
      version?: string;
      started_at?: string;
    };
    const build = parseComponentBuildMeta(body.build);
    const startedAt =
      typeof body.started_at === "string" && body.started_at.trim()
        ? body.started_at.trim()
        : undefined;
    if (build) return { meta: build, ...(startedAt ? { startedAt } : {}) };
    if (typeof body.version === "string" && body.version.trim()) {
      return {
        meta: {
          component: "service",
          version: body.version.trim(),
          channel: "local",
        },
        ...(startedAt ? { startedAt } : {}),
      };
    }
    return { meta: null, ...(startedAt ? { startedAt } : {}) };
  } catch {
    return { meta: null };
  }
}

async function fetchWebBuildMeta(): Promise<ComponentBuildMeta | null> {
  try {
    const configPath = `${import.meta.env.BASE_URL}config.json`.replace(/\/{2,}/g, "/");
    const res = await fetch(configPath, { cache: "no-store" });
    if (!res.ok) return null;
    const cfg = parseWebUiConfigJson(await res.json());
    if (cfg?.web_build) return cfg.web_build;
    if (cfg?.ui_version) {
      return {
        component: "web",
        version: cfg.ui_version,
        channel: "local",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function AboutPanel() {
  /** null：桥未决议，不渲染 Web/原生壳卡片，避免「原生壳→Web UI」闪烁 */
  const [shellKind, setShellKind] = useState<ShellRuntimeKind | null>(null);
  const showWebSection = shellKind === "web";
  const showNative = shellKind != null && shellKind !== "web";
  const [serviceAbout, setServiceAbout] = useState<ServiceAboutInfo | undefined>(undefined);
  const [webBuild, setWebBuild] = useState<ComponentBuildMeta | null | undefined>(undefined);
  const [nativeBuild, setNativeBuild] = useState<ComponentBuildMeta | null | undefined>(undefined);
  const [updateProxy, setUpdateProxy] = useState<GithubReleaseProxyId>(() =>
    readGithubReleaseProxyPref(),
  );

  useEffect(() => {
    let cancelled = false;
    void fetchServiceAboutInfo().then((value) => {
      if (!cancelled) setServiceAbout(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showWebSection) {
      setWebBuild(null);
      return;
    }
    let cancelled = false;
    setWebBuild(undefined);
    void fetchWebBuildMeta().then((value) => {
      if (!cancelled) setWebBuild(value);
    });
    return () => {
      cancelled = true;
    };
  }, [showWebSection]);

  useEffect(() => {
    let cancelled = false;

    const refreshNative = (): void => {
      void resolveAboutNativeBuildMeta().then((value) => {
        if (!cancelled) setNativeBuild(value);
      });
    };

    const run = async (): Promise<void> => {
      const bridgeReady = (
        window as Window & { __freeanimaShellBridge?: { ready?: Promise<void> } }
      ).__freeanimaShellBridge?.ready;
      if (bridgeReady) {
        try {
          await bridgeReady;
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      // Tauri WebView：即使 bridge 误走 web stub，也不回落成 Web UI
      const kind: ShellRuntimeKind = isTauriRuntime() ? "tauri" : getShellKind();

      setShellKind(kind);
      if (kind === "web") {
        setNativeBuild(null);
        return;
      }
      refreshNative();
    };

    void run();
    window.addEventListener(NATIVE_BUILD_META_CHANGED_EVENT, refreshNative);
    window.addEventListener("freeanima:shell-config-changed", refreshNative);
    return () => {
      cancelled = true;
      window.removeEventListener(NATIVE_BUILD_META_CHANGED_EVENT, refreshNative);
      window.removeEventListener("freeanima:shell-config-changed", refreshNative);
    };
  }, []);

  const canCheckNative = resolveNativePackagedKind() != null;
  const nativeChannel = nativeBuild?.channel;
  const canSwitchChannel =
    canCheckNative && nativeChannel != null && isSwitchableChannel(nativeChannel);
  const switchTarget: UpdateTrack | null = canSwitchChannel
    ? otherUpdateTrack(nativeChannel)
    : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        {canCheckNative ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">{"下载代理"}</span>
            <select
              className={proxySelectClassName}
              value={updateProxy}
              onChange={(e) => {
                const next = e.target.value as GithubReleaseProxyId;
                setUpdateProxy(next);
                writeGithubReleaseProxyPref(next);
              }}
            >
              {GITHUB_RELEASE_PROXY_IDS.map((id) => (
                <option key={id} value={id}>
                  {proxyOptionLabel(id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canCheckNative ? (
          <Button type="button" size="sm" onClick={() => requestShellUpdateCheck()}>
            {"检查更新"}
          </Button>
        ) : null}
        {switchTarget ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              requestShellUpdateCheck({ intent: "switch", targetChannel: switchTarget })
            }
          >
            {`切换到 ${switchTarget}`}
          </Button>
        ) : null}
        {showWebSection ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("freeanima:pwa-update-check"));
            }}
          >
            {"检查更新"}
          </Button>
        ) : null}
      </div>{" "}
      <BuildMetaGroup
        title={"服务"}
        meta={serviceAbout?.meta}
        loading={serviceAbout === undefined}
        {...(serviceAbout?.startedAt ? { startedAt: serviceAbout.startedAt } : {})}
      />
      {showWebSection ? (
        <BuildMetaGroup title={"Web UI"} meta={webBuild} loading={webBuild === undefined} />
      ) : null}
      {showNative ? (
        <BuildMetaGroup title={"原生壳"} meta={nativeBuild} loading={nativeBuild === undefined} />
      ) : null}
    </div>
  );
}
