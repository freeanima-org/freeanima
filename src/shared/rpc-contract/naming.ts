export type ParsedRemoteToolName = {
  app_slug: string;
  instance_id_norm: string;
  local_name: string;
  canonical: string;
};

export type ParsedRemotePlatform = {
  app_slug: string;
  instance_id_norm: string;
  platform: string;
};

/** Habitat-assigned instance ids: 3 lowercase alphanumeric chars */
export const REMOTE_INSTANCE_ID_PATTERN = /^[a-z0-9]{3}$/;

const INSTANCE_NORM_RE = /^([a-z0-9]{3,64})_(.+)$/;
const PLATFORM_PREFIXES = ["remote"] as const;
const TOOL_UNDERSCORE_PREFIXES = ["remote_"] as const;

export function normalizeAppSlug(appId: string): string {
  return appId.trim().toLowerCase().replace(/[-_]/g, "");
}

export function normalizeInstanceId(instanceId: string): string {
  return instanceId.trim().toLowerCase().replace(/-/g, "");
}

export function isValidRemoteInstanceId(instanceId: string): boolean {
  return REMOTE_INSTANCE_ID_PATTERN.test(normalizeInstanceId(instanceId));
}

/**
 * 工具名 / outpost status 用的 `remote:{app}:{instance}` 标识。
 * **不是** conversations.platform_info.platform（会话通道用 flat：chat|coding|companion|…）。
 */
export function formatRemotePlatform(appId: string, instanceId: string): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  return `remote:${app_slug}:${instance_id_norm}`;
}

/**
 * 会话 list/create 默认 platform：显式 input 优先；否则 flat `normalizeAppSlug(appId)`。
 * Empty REST ctx（`app_id`/`instance_id` ""）不得合成非法值。
 */
export function resolveDefaultRemotePlatform(
  platform: string | undefined,
  appId: string,
  instanceId: string,
): string | undefined {
  if (platform !== undefined) {
    const trimmed = platform.trim();
    return trimmed || undefined;
  }
  if (appId.trim() && instanceId.trim()) {
    return normalizeAppSlug(appId);
  }
  return undefined;
}

export function isRemotePlatform(platform: string): boolean {
  return parseRemotePlatform(platform).ok;
}

export function parseRemotePlatform(
  platform: string,
): { ok: true; value: ParsedRemotePlatform } | { ok: false; error: string } {
  const parts = platform.split(":");
  const prefix = parts[0] ?? "";
  if (
    parts.length !== 3 ||
    !(PLATFORM_PREFIXES as readonly string[]).includes(prefix) ||
    !parts[1] ||
    !parts[2]
  ) {
    return { ok: false, error: `invalid remote platform: ${platform}` };
  }
  const app_slug = parts[1];
  const instance_id_norm = parts[2];
  return {
    ok: true,
    value: {
      app_slug,
      instance_id_norm,
      platform: formatRemotePlatform(app_slug, instance_id_norm),
    },
  };
}

export function formatRemoteToolName(appId: string, instanceId: string, localName: string): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  const local_name = localName.trim();
  return `remote_${app_slug}_${instance_id_norm}_${local_name}`;
}

export function formatRemoteToolNameAlias(
  appId: string,
  instanceId: string,
  localName: string,
): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  const local_name = localName.trim();
  return `remote:${app_slug}:${instance_id_norm}:${local_name}`;
}

export function isRemotePrefixedToolName(name: string): boolean {
  return name.startsWith("remote_") || name.startsWith("remote:");
}

export function parseRemoteToolName(
  name: string,
): { ok: true; value: ParsedRemoteToolName } | { ok: false; error: string } {
  for (const prefix of PLATFORM_PREFIXES) {
    const colon = `${prefix}:`;
    if (!name.startsWith(colon)) continue;
    const parts = name.split(":");
    if (parts.length < 4 || parts[0] !== prefix) {
      return { ok: false, error: `invalid ${colon} tool name: ${name}` };
    }
    const app_slug = parts[1] ?? "";
    const instance_id_norm = parts[2] ?? "";
    const local_name = parts.slice(3).join(":");
    if (!app_slug || !instance_id_norm || !local_name) {
      return { ok: false, error: `invalid ${colon} tool name: ${name}` };
    }
    const canonical = formatRemoteToolName(app_slug, instance_id_norm, local_name);
    return { ok: true, value: { app_slug, instance_id_norm, local_name, canonical } };
  }

  for (const underscore of TOOL_UNDERSCORE_PREFIXES) {
    if (!name.startsWith(underscore)) continue;
    const body = name.slice(underscore.length);
    const firstSep = body.indexOf("_");
    if (firstSep <= 0) {
      return { ok: false, error: `invalid ${underscore} tool name: ${name}` };
    }
    const app_slug = body.slice(0, firstSep);
    const rest = body.slice(firstSep + 1);
    const match = INSTANCE_NORM_RE.exec(rest);
    if (!match) {
      return { ok: false, error: `invalid ${underscore} tool name segments: ${name}` };
    }
    const instance_id_norm = match[1] ?? "";
    const local_name = match[2] ?? "";
    if (!local_name) {
      return { ok: false, error: `missing local_name in remote tool: ${name}` };
    }
    return {
      ok: true,
      value: {
        app_slug,
        instance_id_norm,
        local_name,
        canonical: formatRemoteToolName(app_slug, instance_id_norm, local_name),
      },
    };
  }

  return { ok: false, error: `not a remote tool name: ${name}` };
}

export function remoteToolsetId(appId: string, instanceId: string): string {
  return `remote_${normalizeAppSlug(appId)}_${normalizeInstanceId(instanceId)}`;
}
