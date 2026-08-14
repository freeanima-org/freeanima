import { omitUndefined } from "./omit-undefined.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export type ApiProtocolPayload = {
  error?: string;
  message?: string;
  code?: string;
  params?: Record<string, string>;
};

export function translateApiPayload(payload: ApiProtocolPayload | null | undefined): string {
  if (!payload) return "请求失败";
  const code = payload.code;
  const params = payload.params ?? {};

  if (code === "cron_job_not_found") {
    return `未找到任务: ${params.job_id ?? ""}`;
  }
  if (code === "cron_job_create_failed") {
    return payload.error ?? "创建定时任务失败";
  }
  if (code === "cron_job_delete_failed") {
    return payload.error ?? `删除定时任务失败: ${params.job_id ?? ""}`;
  }
  if (code === "service_restarting") {
    return "服务正在重启...";
  }
  if (code === "email_account_not_found") {
    return `未找到账户: ${params.account_id ?? ""}`;
  }
  if (code === "semantic_memory_count") {
    return `语义记忆：${params.count ?? ""} 条（PG content_fts 自动维护，无需重建）`;
  }
  if (code === "studio_workspace_missing") {
    return "studio.workspace 未配置或不存在";
  }
  if (code === "terminal_session_not_found") {
    return "终端会话不存在或已关闭";
  }

  return payload.error ?? payload.message ?? "请求失败";
}

export function translateApiErrorValue(value: unknown): string {
  if (value == null) return "请求失败";
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
  return normalizeNetworkErrorMessage(coerceString(value));
}

function normalizeNetworkErrorMessage(message: string): string {
  const lower = message.trim().toLowerCase();
  if (
    lower === "failed to fetch" ||
    lower === "networkerror when attempting to fetch resource." ||
    lower.includes("network error") ||
    lower === "load failed"
  ) {
    return "网络错误";
  }
  return message;
}
