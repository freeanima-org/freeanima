import { omitUndefined } from "./omit-undefined.ts";
import { m } from "./i18n.ts";

export type ApiWirePayload = {
  error?: string;
  message?: string;
  code?: string;
  params?: Record<string, string>;
};

export function translateApiPayload(payload: ApiWirePayload | null | undefined): string {
  if (!payload) return m.console_common_request_failed();
  const code = payload.code;
  const params = payload.params ?? {};

  if (code === "cron_job_not_found") {
    return m.console_api_cron_job_not_found({ id: params.job_id ?? "" });
  }
  if (code === "service_restarting") {
    return m.console_api_service_restarting();
  }
  if (code === "email_account_not_found") {
    return m.console_api_email_account_not_found({ account_id: params.account_id ?? "" });
  }
  if (code === "semantic_memory_count") {
    return m.console_api_semantic_memory_count({ count: params.count ?? "" });
  }
  if (code === "studio_workspace_missing") {
    return m.console_api_studio_workspace_missing();
  }
  if (code === "terminal_session_not_found") {
    return m.console_api_terminal_session_not_found();
  }

  return payload.error ?? payload.message ?? m.console_common_request_failed();
}

export function translateApiErrorValue(value: unknown): string {
  if (value == null) return m.console_common_request_failed();
  if (typeof value === "string") {
    return normalizeNetworkErrorMessage(value);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.code === "string" || typeof obj.error === "string") {
      return translateApiPayload(
        omitUndefined({
          code: typeof obj.code === "string" ? obj.code : undefined,
          error: typeof obj.error === "string" ? obj.error : undefined,
          message: typeof obj.message === "string" ? obj.message : undefined,
          params:
            obj.params && typeof obj.params === "object"
              ? (obj.params as Record<string, string>)
              : undefined,
        }),
      );
    }
    if (typeof obj.message === "string") return normalizeNetworkErrorMessage(obj.message);
    if (typeof obj.value === "string") return normalizeNetworkErrorMessage(obj.value);
  }
  return normalizeNetworkErrorMessage(String(value));
}

function normalizeNetworkErrorMessage(message: string): string {
  const lower = message.trim().toLowerCase();
  if (
    lower === "failed to fetch" ||
    lower === "networkerror when attempting to fetch resource." ||
    lower.includes("network error") ||
    lower === "load failed"
  ) {
    return m.console_common_network_error();
  }
  return message;
}
