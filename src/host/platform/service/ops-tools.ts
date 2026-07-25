import { isBootstrapConfigKey } from "@freeanima/host/core/config";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult, type ToolArgs } from "@freeanima/host/core/tool";
import {
  findForbiddenLlmConfigPatchPath,
  isPatchableRuntimeConfig,
  maskConfigSecretsForLlm,
  restoreMaskedSecrets,
} from "@freeanima/host/platform/config";
import { getAppRuntime } from "@freeanima/host/platform/ports";
import { triggerServiceRestart } from "@freeanima/host/platform/ports/process-restart";

import { OPS_TOOL_RETURNS } from "./ops-return-schemas.ts";

const CONFIRM_REQUIRED =
  "confirm=true required; first use clarify ToolSet to get partner approval, then retry with confirm=true";

export type OpsToolDeps = {
  getRuntime: typeof getAppRuntime;
  scheduleRestart: (delayMs?: number) => void;
};

const defaultScheduleRestart = (delayMs = 100): void => {
  setTimeout(() => {
    void triggerServiceRestart();
  }, delayMs);
};

let deps: OpsToolDeps = {
  getRuntime: getAppRuntime,
  scheduleRestart: defaultScheduleRestart,
};

/** Unit tests inject mocks */
export function bindOpsToolDeps(next: Partial<OpsToolDeps>): void {
  deps = { ...deps, ...next };
}

export function resetOpsToolDepsForTest(): void {
  deps = {
    getRuntime: getAppRuntime,
    scheduleRestart: defaultScheduleRestart,
  };
}

function requireConfirm(args: ToolArgs): string | null {
  if (args.confirm === true) return null;
  return CONFIRM_REQUIRED;
}

function asPatchRecord(raw: unknown): Record<string, unknown> | string {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return "patch must be an object";
  }
  return raw as Record<string, unknown>;
}

export async function handleOpsHealth(): Promise<string> {
  try {
    return toolResult(deps.getRuntime().health());
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleOpsStatus(): Promise<string> {
  try {
    const rt = deps.getRuntime();
    const status = await rt.buildStatus(rt.host, rt.port);
    return toolResult(status);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleOpsConfigGet(args: ToolArgs): Promise<string> {
  try {
    const rt = deps.getRuntime();
    const full = maskConfigSecretsForLlm(rt.getConfig().config);
    const sectionRaw = args.section == null ? "" : String(args.section).trim();
    if (!sectionRaw) {
      return toolResult({ config: full });
    }
    if (isBootstrapConfigKey(sectionRaw)) {
      return toolError(
        `section ${sectionRaw} is bootstrap (cold-start) config; not available via ops tools`,
      );
    }
    const value = full[sectionRaw];
    if (value === undefined) {
      return toolResult({ config: {}, section: sectionRaw });
    }
    return toolResult({
      config: { [sectionRaw]: value },
      section: sectionRaw,
    });
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleOpsConfigPatch(args: ToolArgs): Promise<string> {
  const confirmErr = requireConfirm(args);
  if (confirmErr) return toolError(confirmErr);

  const section = String(args.section ?? "").trim();
  if (!section) return toolError("section is required");
  if (isBootstrapConfigKey(section)) {
    return toolError(`section ${section} is bootstrap (cold-start) config; cannot patch via ops`);
  }

  const patchOrError = asPatchRecord(args.patch);
  if (typeof patchOrError === "string") return toolError(patchOrError);
  const patch = patchOrError;

  const forbidden = findForbiddenLlmConfigPatchPath(patch);
  if (forbidden) {
    return toolError(
      `patch path ${forbidden} is forbidden for LLM ops (secrets / mcp env|headers); edit in Habitat settings UI`,
    );
  }

  try {
    const rt = deps.getRuntime();
    const config = rt.engine.config;
    if (!isPatchableRuntimeConfig(config)) {
      return toolError("current config store is not patchable");
    }
    const existing = (config.data as Record<string, unknown>)[section];
    const restored = restoreMaskedSecrets(patch, existing);
    await config.patchSection(section, restored);
    const masked = maskConfigSecretsForLlm(config.data as Record<string, unknown>);
    return toolResult({ ok: true as const, section, config: masked });
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleOpsRestart(args: ToolArgs): Promise<string> {
  const confirmErr = requireConfirm(args);
  if (confirmErr) return toolError(confirmErr);

  try {
    deps.scheduleRestart();
    return toolResult({ ok: true as const, code: "service_restarting" as const });
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
}

export function registerOpsTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "ops",
    "Habitat operations: health, status, sanitized config, confirmed config patch / restart",
    attachToolReturns(
      [
        {
          name: "ops_health",
          description: "Habitat process health probe (version, started_at).",
          parameters: { type: "object", properties: {} },
          handler: () => handleOpsHealth(),
        },
        {
          name: "ops_status",
          description:
            "Full Habitat service status snapshot (memory, dependencies, extensions, conversation counts). Prefer over guessing from terminal.",
          parameters: { type: "object", properties: {} },
          handler: () => handleOpsStatus(),
        },
        {
          name: "ops_config_get",
          description:
            "Read Habitat runtime config with secrets masked (***). Optional section name. Bootstrap sections (database/http/redis) are not exposed. Never ask partner to paste secrets into chat.",
          parameters: {
            type: "object",
            properties: {
              section: {
                type: "string",
                description: "Optional runtime config section (e.g. llm, browser, gateway)",
              },
            },
          },
          handler: (args) => handleOpsConfigGet(args),
        },
        {
          name: "ops_config_patch",
          description:
            "Patch a Habitat runtime config section. Requires confirm=true after partner approval via clarify. Forbidden: bootstrap sections, secret keys, mcp env/headers. Secrets must be edited in Habitat settings UI / vault.",
          parameters: {
            type: "object",
            properties: {
              section: { type: "string", description: "Runtime config section name" },
              patch: {
                type: "object",
                description: "Partial section object to deep-merge",
              },
              confirm: {
                type: "boolean",
                description: "Must be true after clarify partner approval",
              },
            },
            required: ["section", "patch", "confirm"],
          },
          handler: (args) => handleOpsConfigPatch(args),
        },
        {
          name: "ops_restart",
          description:
            "Schedule Habitat service restart (systemd user unit or SIGTERM). Requires confirm=true after partner approval via clarify. Connection will drop.",
          parameters: {
            type: "object",
            properties: {
              confirm: {
                type: "boolean",
                description: "Must be true after clarify partner approval",
              },
            },
            required: ["confirm"],
          },
          handler: (args) => handleOpsRestart(args),
        },
      ],
      OPS_TOOL_RETURNS,
    ),
  );
}
