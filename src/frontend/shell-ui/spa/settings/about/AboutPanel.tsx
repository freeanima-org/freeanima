import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@freeanima/ui-kit";
import type { ComponentBuildMeta } from "@freeanima/shell-sdk/build-meta";
import { resolveHubApiOrigin } from "@freeanima/shell-sdk/hub-api-origin";
import { parseComponentBuildMeta } from "@freeanima/shell-sdk/build-meta";
import { parseWebUiConfigJson } from "@freeanima/shell-sdk/web-ui-config";

import * as m from "../../../../../../messages/paraglide/messages.js";

function isNativeShellRuntime(): boolean {
  return Boolean(window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell);
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
    const res = await fetch(`${origin}/api/health`, { cache: "no-store" });
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

  const nativeBuild = window.satelliteShell?.nativeBuild ?? null;
  const showNative = isNativeShellRuntime();

  return (
    <div className="space-y-4 max-w-3xl">
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
        <BuildMetaGroup title={m.settings_about_group_native()} meta={nativeBuild} />
      ) : null}
    </div>
  );
}
