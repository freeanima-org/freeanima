import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@freeanima/frontend/ui-kit";
import type { ComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";
import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "@freeanima/frontend/shell-sdk/capacitor-runtime";
import { resolveHubApiOrigin } from "@freeanima/frontend/shell-sdk/hub-api-origin";
import { hubHealthProbeUrl } from "@freeanima/shared/hub-rpc";
import {
  isSwitchableChannel,
  otherUpdateTrack,
  resolveNativePackagedKind,
  type UpdateTrack,
} from "@freeanima/frontend/shell-sdk/app-update";
import { parseComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";
import {
  GITHUB_RELEASE_PROXY_IDS,
  type GithubReleaseProxyId,
} from "@freeanima/frontend/shell-sdk/github-release-proxy";
import {
  readGithubReleaseProxyPref,
  writeGithubReleaseProxyPref,
} from "@freeanima/frontend/shell-sdk/github-release-proxy-prefs";
import {
  NATIVE_BUILD_META_CHANGED_EVENT,
  resolveAboutNativeBuildMeta,
} from "@freeanima/frontend/shell-sdk/native-build-meta.resolve";
import { parseWebUiConfigJson } from "@freeanima/frontend/shell-sdk/web-ui-config";

import { m } from "@paraglide/messages";
import { requestShellUpdateCheck } from "../../ShellUpdateBanner.tsx";

const proxySelectClassName =
  "border-input flex h-8 min-w-[10rem] rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function proxyOptionLabel(id: GithubReleaseProxyId): string {
  switch (id) {
    case "none":
      return m.ui_shell_update_proxy_none();
    case "ghproxy-net":
      return m.ui_shell_update_proxy_ghproxy_net();
    case "gh-proxy-com":
      return m.ui_shell_update_proxy_gh_proxy_com();
    case "ghfast-top":
      return m.ui_shell_update_proxy_ghfast_top();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
function isNativeShellRuntime(): boolean {
  return Boolean(window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell);
}

function showNativeAboutSection(): boolean {
  return isNativeShellRuntime() || isCapacitorNativePlatform() || isMobileCapacitorShellCandidate();
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
    return <p className="text-sm text-muted-foreground">{m.settings_about_loading()}</p>;
  }
  if (!meta) {
    return <p className="text-sm text-muted-foreground">{m.settings_about_unavailable()}</p>;
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: m.settings_about_field_version(), value: meta.version },
    { label: m.settings_about_field_channel(), value: meta.channel },
  ];
  if (meta.component === "native" && meta.shell) {
    rows.push({ label: m.settings_about_field_shell(), value: meta.shell });
  }
  if (meta.git?.commit) {
    rows.push({ label: m.settings_about_field_commit(), value: meta.git.commit });
  }
  if (meta.git?.branch) {
    rows.push({ label: m.settings_about_field_branch(), value: meta.git.branch });
  }
  if (meta.git?.dirty != null) {
    rows.push({
      label: m.settings_about_field_dirty(),
      value: meta.git.dirty ? m.settings_about_dirty_yes() : m.settings_about_dirty_no(),
    });
  }
  if (meta.component === "service" && startedAt) {
    rows.push({
      label: m.settings_about_field_started_at(),
      value: formatBuiltAt(startedAt),
    });
  } else if (meta.built_at) {
    rows.push({
      label: m.settings_about_field_built_at(),
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
    const origin = resolveHubApiOrigin();
    const res = await fetch(hubHealthProbeUrl(origin), { cache: "no-store" });
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
          channel: "dev",
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
        channel: "dev",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function AboutPanel() {
  const [serviceAbout, setServiceAbout] = useState<ServiceAboutInfo | undefined>(undefined);
  const [webBuild, setWebBuild] = useState<ComponentBuildMeta | null | undefined>(undefined);
  const [nativeBuild, setNativeBuild] = useState<ComponentBuildMeta | null | undefined>(undefined);
  const [nativeSection, setNativeSection] = useState<"pending" | "show" | "hide">("pending");
  const [updateProxy, setUpdateProxy] = useState<GithubReleaseProxyId>(() =>
    readGithubReleaseProxyPref(),
  );

  useEffect(() => {
    let cancelled = false;
    void fetchServiceAboutInfo().then((value) => {
      if (!cancelled) setServiceAbout(value);
    });
    void fetchWebBuildMeta().then((value) => {
      if (!cancelled) setWebBuild(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;

    const refresh = (): void => {
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
      if (!showNativeAboutSection()) {
        setNativeSection("hide");
        setNativeBuild(null);
        return;
      }
      setNativeSection("show");
      refresh();
    };

    void run();
    window.addEventListener(NATIVE_BUILD_META_CHANGED_EVENT, refresh);
    window.addEventListener("freeanima:shell-config-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NATIVE_BUILD_META_CHANGED_EVENT, refresh);
      window.removeEventListener("freeanima:shell-config-changed", refresh);
    };
  }, []);

  const showNative = nativeSection !== "hide";
  const isBrowserWeb =
    typeof window !== "undefined" &&
    !window.satelliteShell?.isElectron &&
    !window.satelliteShell?.isNativeShell;
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
            <span className="text-muted-foreground whitespace-nowrap">
              {m.ui_shell_update_proxy_label()}
            </span>
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
            {m.ui_shell_update_check()}
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
            {m.ui_shell_channel_switch({ channel: switchTarget })}
          </Button>
        ) : null}
        {isBrowserWeb ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("freeanima:pwa-update-check"));
            }}
          >
            {m.ui_shell_update_check()}
          </Button>
        ) : null}
      </div>{" "}
      <BuildMetaGroup
        title={m.settings_about_group_service()}
        meta={serviceAbout?.meta}
        loading={serviceAbout === undefined}
        {...(serviceAbout?.startedAt ? { startedAt: serviceAbout.startedAt } : {})}
      />
      <BuildMetaGroup
        title={m.settings_about_group_web()}
        meta={webBuild}
        loading={webBuild === undefined}
      />
      {showNative ? (
        <BuildMetaGroup
          title={m.settings_about_group_native()}
          meta={nativeBuild}
          loading={nativeBuild === undefined}
        />
      ) : null}
    </div>
  );
}
