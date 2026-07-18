export type ParsedSapToolName = {
  app_slug: string;
  instance_id_norm: string;
  local_name: string;
  canonical: string;
};

export type ParsedSapPlatform = {
  app_slug: string;
  instance_id_norm: string;
  platform: string;
};

/** Hub-assigned instance ids: 3 lowercase alphanumeric chars */
export const SAP_INSTANCE_ID_PATTERN = /^[a-z0-9]{3}$/;

const INSTANCE_NORM_RE = /^([a-z0-9]{3,64})_(.+)$/;

export function normalizeAppSlug(appId: string): string {
  return appId.trim().toLowerCase().replace(/[-_]/g, "");
}

export function normalizeInstanceId(instanceId: string): string {
  return instanceId.trim().toLowerCase().replace(/-/g, "");
}

export function isValidSapInstanceId(instanceId: string): boolean {
  return SAP_INSTANCE_ID_PATTERN.test(normalizeInstanceId(instanceId));
}

export function formatSapPlatform(appId: string, instanceId: string): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  return `sap:${app_slug}:${instance_id_norm}`;
}

/**
 * Resolve list/create platform: explicit input wins; otherwise SAP identity.
 * Empty REST ctx (`app_id`/`instance_id` "") must NOT become `"sap::"`.
 */
export function resolveDefaultSapPlatform(
  platform: string | undefined,
  appId: string,
  instanceId: string,
): string | undefined {
  if (platform !== undefined) {
    const trimmed = platform.trim();
    return trimmed || undefined;
  }
  if (appId.trim() && instanceId.trim()) {
    return formatSapPlatform(appId, instanceId);
  }
  return undefined;
}

export function isSapPlatform(platform: string): boolean {
  return platform.startsWith("sap:") && parseSapPlatform(platform).ok;
}

export function parseSapPlatform(
  platform: string,
): { ok: true; value: ParsedSapPlatform } | { ok: false; error: string } {
  if (!platform.startsWith("sap:")) {
    return { ok: false, error: `not a sap platform: ${platform}` };
  }
  const parts = platform.split(":");
  if (parts.length !== 3 || parts[0] !== "sap") {
    return { ok: false, error: `invalid sap platform: ${platform}` };
  }
  const app_slug = parts[1] ?? "";
  const instance_id_norm = parts[2] ?? "";
  if (!app_slug || !instance_id_norm) {
    return { ok: false, error: `invalid sap platform segments: ${platform}` };
  }
  return {
    ok: true,
    value: { app_slug, instance_id_norm, platform: `sap:${app_slug}:${instance_id_norm}` },
  };
}

export function formatSapToolName(appId: string, instanceId: string, localName: string): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  const local_name = localName.trim();
  return `sap_${app_slug}_${instance_id_norm}_${local_name}`;
}

export function formatSapToolNameAlias(
  appId: string,
  instanceId: string,
  localName: string,
): string {
  const app_slug = normalizeAppSlug(appId);
  const instance_id_norm = normalizeInstanceId(instanceId);
  const local_name = localName.trim();
  return `sap:${app_slug}:${instance_id_norm}:${local_name}`;
}

export function isSapPrefixedToolName(name: string): boolean {
  return name.startsWith("sap_") || name.startsWith("sap:");
}

export function parseSapToolName(
  name: string,
): { ok: true; value: ParsedSapToolName } | { ok: false; error: string } {
  if (name.startsWith("sap:")) {
    const parts = name.split(":");
    if (parts.length < 4 || parts[0] !== "sap") {
      return { ok: false, error: `invalid sap: tool name: ${name}` };
    }
    const app_slug = parts[1] ?? "";
    const instance_id_norm = parts[2] ?? "";
    const local_name = parts.slice(3).join(":");
    if (!app_slug || !instance_id_norm || !local_name) {
      return { ok: false, error: `invalid sap: tool name: ${name}` };
    }
    const canonical = formatSapToolName(app_slug, instance_id_norm, local_name);
    return { ok: true, value: { app_slug, instance_id_norm, local_name, canonical } };
  }

  if (!name.startsWith("sap_")) {
    return { ok: false, error: `not a sap tool name: ${name}` };
  }

  const body = name.slice(4);
  const firstSep = body.indexOf("_");
  if (firstSep <= 0) {
    return { ok: false, error: `invalid sap_ tool name: ${name}` };
  }

  const app_slug = body.slice(0, firstSep);
  const rest = body.slice(firstSep + 1);
  const match = INSTANCE_NORM_RE.exec(rest);
  if (!match) {
    return { ok: false, error: `invalid sap_ tool name segments: ${name}` };
  }

  const instance_id_norm = match[1] ?? "";
  const local_name = match[2] ?? "";
  if (!local_name) {
    return { ok: false, error: `missing local_name in sap tool: ${name}` };
  }

  return {
    ok: true,
    value: {
      app_slug,
      instance_id_norm,
      local_name,
      canonical: formatSapToolName(app_slug, instance_id_norm, local_name),
    },
  };
}

export function sapToolsetId(appId: string, instanceId: string): string {
  return `sap_${normalizeAppSlug(appId)}_${normalizeInstanceId(instanceId)}`;
}
