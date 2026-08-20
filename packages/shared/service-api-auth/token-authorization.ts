import { z } from "zod";

import {
  dataCapabilityFragmentSchema,
  openDataCapability,
  type DataCapabilityFragment,
} from "./data-capability.ts";

export const serviceApiTokenPortalSchema = z.enum(["app", "extension", "mcp"]);
export type ServiceApiTokenPortal = z.infer<typeof serviceApiTokenPortalSchema>;

const scopedAuthorizationSchema = z.object({
  full: z.literal(false),
  portal: serviceApiTokenPortalSchema,
  modules: z.array(z.string().min(1)).min(1),
  data: dataCapabilityFragmentSchema,
});

const fullAuthorizationSchema = z.object({
  full: z.literal(true),
});

export const serviceApiTokenAuthorizationSchema = z.discriminatedUnion("full", [
  fullAuthorizationSchema,
  scopedAuthorizationSchema,
]);

export type ServiceApiTokenAuthorization = z.infer<typeof serviceApiTokenAuthorizationSchema>;

export const FULL_TOKEN_AUTHORIZATION: ServiceApiTokenAuthorization = { full: true };

export type TokenAuthorizationPreset = "app" | "extension" | "mcp";

/** 浏览器扩展常用 module / component 白名单（成对） */
export const EXTENSION_TOKEN_MODULES = [
  "chat",
  "shell_quick",
  "entity",
  "tag",
  "vault",
  "health",
  "tls",
] as const;

export const EXTENSION_TOKEN_COMPONENTS = ["vault_item", "tag"] as const;

/**
 * 令牌自定义授权可选的 RPC 模块（method 名 `.` 前缀）。
 * 不含 `tokens`：管理面须 `full`。
 */
export const SERVICE_API_TOKEN_MODULE_OPTIONS = [
  "bookmark",
  "calendar",
  "chat",
  "coding",
  "companion",
  "config",
  "conversation",
  "diary",
  "email",
  "emailaccount",
  "emailprovider",
  "emailthread",
  "entity",
  "fts",
  "health",
  "llm_debug",
  "mcp",
  "memory",
  "message",
  "note",
  "notification",
  "object_storage",
  "outposts",
  "pomodoro",
  "project",
  "projectfolder",
  "prompt",
  "remote_tools",
  "self",
  "shell_quick",
  "skill",
  "smartlist",
  "status",
  "stream",
  "subagent",
  "tag",
  "task",
  "tasklist",
  "terminal",
  "tls",
  "tool",
  "tts",
  "usage",
  "vault",
  "worlds",
] as const;

export function expandTokenPreset(
  preset: TokenAuthorizationPreset,
  opts?: { worldIds?: readonly number[] },
): ServiceApiTokenAuthorization {
  const worlds: Array<number | "*"> =
    opts?.worldIds && opts.worldIds.length > 0 ? [...opts.worldIds] : ["*"];

  if (preset === "extension") {
    return {
      full: false,
      portal: "extension",
      modules: [...EXTENSION_TOKEN_MODULES],
      data: {
        allowed_components: [...EXTENSION_TOKEN_COMPONENTS],
        denied_components: [],
        allowed_worlds: worlds,
        denied_worlds: [],
        access: "write",
      },
    };
  }

  const data: DataCapabilityFragment = {
    ...openDataCapability(),
    allowed_worlds: worlds,
  };

  if (preset === "app") {
    return {
      full: false,
      portal: "app",
      modules: ["*"],
      data,
    };
  }

  return {
    full: false,
    portal: "mcp",
    modules: ["*"],
    data,
  };
}

export function parseServiceApiTokenAuthorization(raw: unknown): ServiceApiTokenAuthorization {
  return serviceApiTokenAuthorizationSchema.parse(raw);
}

export function isFullTokenAuthorization(authz: ServiceApiTokenAuthorization): boolean {
  return authz.full;
}

export function tokenAllowsModule(authz: ServiceApiTokenAuthorization, module: string): boolean {
  if (authz.full) return true;
  if (authz.modules.includes("*")) return true;
  return authz.modules.includes(module);
}

export function tokenDataCapability(
  authz: ServiceApiTokenAuthorization,
): DataCapabilityFragment | null {
  if (authz.full) return null;
  return authz.data;
}

/** method 名 `chat.send` → 模块 `chat` */
export function moduleFromRpcMethod(method: string): string {
  const dot = method.indexOf(".");
  return dot <= 0 ? method : method.slice(0, dot);
}
