export function layerOf(rel: string): string {
  if (rel.startsWith("src/ui-kit/")) return "ui-kit";
  if (rel.startsWith("src/client/") || rel.startsWith("src/frontend/")) return "client";
  if (rel.startsWith("src/shared/")) return "shared";
  if (rel.startsWith("src/host/")) return "host";
  if (rel.startsWith("src/features/")) {
    if (rel.includes("/ui/")) return "feature-ui";
    return "feature-server";
  }
  if (rel.startsWith("src/portal/app/") || rel.startsWith("src/portal/extension/")) return "client";
  if (rel.startsWith("src/portal/cli/")) return "host";
  return "other";
}

export function targetLayer(spec: string): string | null {
  if (!spec.startsWith("@freeanima/")) return null;
  const rest = spec.slice("@freeanima/".length);
  if (rest.startsWith("ui-kit") || rest.startsWith("frontend/ui-kit")) return "ui-kit";
  if (rest.startsWith("client/") || rest.startsWith("frontend/")) return "client";
  if (rest.startsWith("shared/")) return "shared";
  if (rest.startsWith("host/")) return "host";
  if (
    rest.startsWith("kernel") ||
    rest.startsWith("core") ||
    rest.startsWith("runtime") ||
    rest.startsWith("capabilities") ||
    rest.startsWith("platform")
  ) {
    return "host";
  }
  if (rest.startsWith("features/")) {
    if (rest.includes("/ui/") || /features\/[^/]+\/ui\b/.test(rest)) return "feature-ui";
    return "feature-server";
  }
  return "other";
}

function isFrontendDbImport(spec: string): boolean {
  if (spec === "drizzle-orm" || spec.startsWith("drizzle-orm/")) return true;
  return (
    spec.includes("@freeanima/host/core/db") ||
    spec.startsWith("@freeanima/core/db") ||
    spec.includes("/host/core/db/")
  );
}

/** 层依赖违规原因；合法返回 null。 */
export function checkLayerDeps(rel: string, spec: string): string | null {
  const from = layerOf(rel);
  const to = targetLayer(spec);

  if ((from === "feature-ui" || from === "client") && isFrontendDbImport(spec)) {
    return "feature-ui/client 不得 import host/core/db 或 drizzle-orm；请用 @freeanima/shared/{db-shapes,entity-shapes}";
  }

  if (!to) return null;

  if (from === "shared" && to === "host") {
    return "shared 不得 import host（纯工具/Zod 须落在 shared）";
  }

  if ((from === "feature-ui" || (from === "client" && rel.includes("/spa/"))) && to === "host") {
    if (
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

  if (from === "host" && (to === "client" || to === "ui-kit")) {
    if (
      rel.endsWith("platform/habitat/client.ts") ||
      rel.endsWith("platform/habitat/feature-method-defs.ts") ||
      rel.endsWith("platform/habitat/install-client-method-registry.ts")
    ) {
      return null;
    }
    return "host 不得 import client/ui-kit";
  }

  if (from === "shared" && (to === "ui-kit" || to === "client")) {
    return "shared 不得 import ui-kit/client（须无 React）";
  }

  if (from === "ui-kit" && (to === "feature-ui" || to === "feature-server" || to === "host")) {
    return "ui-kit 不得 import features/host";
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
