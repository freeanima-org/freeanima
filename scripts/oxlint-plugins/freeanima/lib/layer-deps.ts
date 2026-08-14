export function layerOf(rel: string): string {
  if (rel.startsWith("packages/frontend/ui-kit/")) return "ui-kit";
  if (
    rel.startsWith("packages/frontend/client/") ||
    rel.startsWith("packages/frontend/portal/app/") ||
    rel.startsWith("packages/frontend/portal/extension/")
  ) {
    return "client";
  }
  if (rel.startsWith("packages/shared/")) return "shared";
  if (rel.startsWith("packages/habitat/kernel/loop-mechanism/")) return "habitat";
  if (rel.startsWith("packages/habitat/kernel/")) return "habitat-kernel";
  if (rel.startsWith("packages/habitat/portal/cli/")) return "habitat";
  if (rel.startsWith("packages/habitat/features/")) {
    if (rel.includes("/ui/")) return "feature-ui";
    return "feature-server";
  }
  if (rel.startsWith("packages/frontend/features/")) {
    if (rel.includes("/ui/") || rel.includes("/lib/")) return "feature-ui";
    return "client";
  }
  if (rel.startsWith("packages/habitat/")) return "habitat";
  return "other";
}

export function targetLayer(spec: string): string | null {
  if (!spec.startsWith("@freeanima/")) return null;
  const rest = spec.slice("@freeanima/".length);
  if (rest.startsWith("ui-kit") || rest.startsWith("frontend/ui-kit")) return "ui-kit";
  if (rest.startsWith("client/") || rest.startsWith("frontend/")) return "client";
  if (rest.startsWith("shared/")) return "shared";
  if (rest.startsWith("habitat/kernel") || rest === "habitat/kernel") return "habitat-kernel";
  if (rest.startsWith("habitat/")) return "habitat";
  if (rest.startsWith("host/kernel") || rest === "host/kernel") return "habitat-kernel";
  if (rest.startsWith("host/")) return "habitat";
  if (rest.startsWith("kernel/") || rest === "kernel") return "habitat-kernel";
  if (
    rest.startsWith("core") ||
    rest.startsWith("runtime") ||
    rest.startsWith("capabilities") ||
    rest.startsWith("platform")
  ) {
    return "habitat";
  }
  if (rest.startsWith("features/")) {
    if (rest.includes("/ui/") || /features\/[^/]+\/ui\b/.test(rest)) return "feature-ui";
    if (rest.includes("/lib/") || /features\/[^/]+\/lib\b/.test(rest)) return "feature-ui";
    return "feature-server";
  }
  if (rest.startsWith("portal/")) {
    if (rest.startsWith("portal/cli")) return "habitat";
    return "client";
  }
  return "other";
}

function isFrontendDbImport(spec: string): boolean {
  if (spec === "drizzle-orm" || spec.startsWith("drizzle-orm/")) return true;
  return (
    spec.includes("@freeanima/habitat/core/db") ||
    spec.includes("@freeanima/host/core/db") ||
    spec.startsWith("@freeanima/core/db") ||
    spec.includes("/habitat/core/db/") ||
    spec.includes("/host/core/db/")
  );
}

/** 层依赖违规原因；合法返回 null。 */
export function checkLayerDeps(rel: string, spec: string): string | null {
  const from = layerOf(rel);
  const to = targetLayer(spec);

  if ((from === "feature-ui" || from === "client") && isFrontendDbImport(spec)) {
    return "feature-ui/client 不得 import habitat/core/db 或 drizzle-orm；请用 @freeanima/shared/pg-shapes";
  }

  if (!to) return null;

  if (from === "habitat-kernel" && to !== "habitat-kernel" && to !== "shared") {
    return "habitat/kernel 仅可依赖 kernel 与 shared（无产品 config 段 / 其它 habitat 层）";
  }

  if (from === "shared" && (to === "habitat" || to === "habitat-kernel")) {
    return "shared 不得 import habitat（纯工具/Zod 须落在 shared）";
  }

  if ((from === "feature-ui" || (from === "client" && rel.includes("/spa/"))) && to === "habitat") {
    if (
      spec.includes("@freeanima/habitat/platform") ||
      spec.includes("@freeanima/habitat/engine") ||
      spec.includes("@freeanima/habitat/capabilities") ||
      spec.includes("@freeanima/host/platform") ||
      spec.includes("@freeanima/host/engine") ||
      spec.includes("@freeanima/host/capabilities") ||
      spec.includes("@freeanima/platform") ||
      spec.includes("@freeanima/runtime") ||
      spec.includes("@freeanima/capabilities")
    ) {
      return "feature-ui/client-spa 不得 import platform/engine/capabilities；请经 portal-sdk";
    }
    return null;
  }

  if ((from === "feature-ui" || from === "client") && to === "feature-server") {
    // 仅禁止 domain；protocol / method-defs 仍可由 UI / portal-sdk 消费
    if (spec.includes("/domain/") || /features\/[^/]+\/domain\b/.test(spec)) {
      return "feature-ui 不得 import features/*/domain（同构逻辑请放 shared）";
    }
    return null;
  }

  if ((from === "habitat" || from === "habitat-kernel") && (to === "client" || to === "ui-kit")) {
    if (
      rel.endsWith("platform/habitat/client.ts") ||
      rel.endsWith("platform/habitat/feature-method-defs.ts") ||
      rel.endsWith("platform/habitat/install-client-method-registry.ts")
    ) {
      return null;
    }
    return "habitat 不得 import client/ui-kit";
  }

  if (from === "shared" && (to === "ui-kit" || to === "client")) {
    return "shared 不得 import ui-kit/client（须无 React）";
  }

  if (
    from === "ui-kit" &&
    (to === "feature-ui" || to === "feature-server" || to === "habitat" || to === "habitat-kernel")
  ) {
    return "ui-kit 不得 import features/habitat";
  }
  if (
    from === "ui-kit" &&
    to === "client" &&
    (spec.includes("app-ui") || spec.includes("app-frame"))
  ) {
    return "ui-kit 不得 import app-frame";
  }

  if (
    (from === "feature-ui" || from === "feature-server") &&
    to === "client" &&
    (spec.includes("app-ui") || spec.includes("app-frame"))
  ) {
    return "features 不得 import app-frame";
  }

  return null;
}
