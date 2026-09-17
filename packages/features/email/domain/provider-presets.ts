export const EMAIL_PROVIDER_IDS = ["aliyun", "gmail", "qq", "custom"] as const;

export type EmailProviderId = (typeof EMAIL_PROVIDER_IDS)[number];

export type EmailHostFields = {
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
};

export type EmailProviderPreset = EmailHostFields & {
  id: Exclude<EmailProviderId, "custom">;
  label: string;
};

/** Named provider presets (explicit selection only; no auto-inference). */
export const EMAIL_PROVIDER_PRESETS: Record<
  Exclude<EmailProviderId, "custom">,
  EmailProviderPreset
> = {
  gmail: {
    id: "gmail",
    label: "Gmail",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
  },
  qq: {
    id: "qq",
    label: "QQ Mail",
    imap_host: "imap.qq.com",
    imap_port: 993,
    smtp_host: "smtp.qq.com",
    smtp_port: 465,
  },
  aliyun: {
    id: "aliyun",
    label: "Aliyun Mail",
    imap_host: "imap.qiye.aliyun.com",
    imap_port: 993,
    smtp_host: "smtp.qiye.aliyun.com",
    smtp_port: 465,
  },
};

export function listEmailProviderPresets(): EmailProviderPreset[] {
  return Object.values(EMAIL_PROVIDER_PRESETS);
}

export function isNamedEmailProvider(
  provider: string | undefined,
): provider is Exclude<EmailProviderId, "custom"> {
  return provider === "aliyun" || provider === "gmail" || provider === "qq";
}

export type ApplyProviderPresetInput = {
  provider?: string | undefined;
  smtp_host?: string | undefined;
  smtp_port?: number | undefined;
  imap_host?: string | undefined;
  imap_port?: number | undefined;
};

/**
 * Fill missing IMAP/SMTP host/port from an explicit named provider.
 * Explicit host/port fields always win. `custom` / missing provider fills nothing.
 */
export function applyProviderPreset<T extends ApplyProviderPresetInput>(input: T): T {
  if (!isNamedEmailProvider(input.provider)) {
    return input;
  }
  const preset = EMAIL_PROVIDER_PRESETS[input.provider];
  return {
    ...input,
    smtp_host: input.smtp_host?.trim() || preset.smtp_host,
    smtp_port: input.smtp_port ?? preset.smtp_port,
    imap_host: input.imap_host?.trim() || preset.imap_host,
    imap_port: input.imap_port ?? preset.imap_port,
  };
}

function isPositivePort(n: number | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

export function requireCompleteEmailHosts(fields: {
  smtp_host?: string | undefined;
  smtp_port?: number | undefined;
  imap_host?: string | undefined;
  imap_port?: number | undefined;
}): EmailHostFields {
  const smtp_host = fields.smtp_host?.trim() ?? "";
  const imap_host = fields.imap_host?.trim() ?? "";
  const missing: string[] = [];
  if (!smtp_host) missing.push("smtp_host");
  if (!isPositivePort(fields.smtp_port)) missing.push("smtp_port");
  if (!imap_host) missing.push("imap_host");
  if (!isPositivePort(fields.imap_port)) missing.push("imap_port");
  if (
    missing.length > 0 ||
    !isPositivePort(fields.smtp_port) ||
    !isPositivePort(fields.imap_port)
  ) {
    throw new Error(
      `Missing IMAP/SMTP fields (${missing.join(", ") || "smtp_port, imap_port"}). Provide provider (aliyun|gmail|qq) or full host/port.`,
    );
  }
  return {
    smtp_host,
    smtp_port: fields.smtp_port,
    imap_host,
    imap_port: fields.imap_port,
  };
}

/** @deprecated Prefer requireCompleteEmailHosts */
export function assertCompleteEmailHosts(fields: {
  smtp_host?: string | undefined;
  smtp_port?: number | undefined;
  imap_host?: string | undefined;
  imap_port?: number | undefined;
}): asserts fields is EmailHostFields {
  requireCompleteEmailHosts(fields);
}
