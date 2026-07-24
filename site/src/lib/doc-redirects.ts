/** 301 redirects for docs paths moved across restructures. */
const docMoves: Record<string, string> = {
  // v2 flat → concepts/guide
  "/docs/identity/": "/docs/product/identity/",
  "/docs/self-layer/": "/docs/cognition/self-layer/",
  "/docs/memory/": "/docs/cognition/memory/",
  "/docs/compression/": "/docs/cognition/compression/",
  "/docs/sleep/": "/docs/cognition/sleep/",
  "/docs/security/": "/docs/ops/security/",
  "/docs/database/": "/docs/ops/database/",
  "/docs/versioning/": "/docs/",
  "/docs/designs/recall-flow/": "/docs/cognition/recall-flow/",
  "/docs/designs/time-perception/": "/docs/cognition/time-perception/",
  "/docs/designs/companion-v1/": "/docs/modules/companion/",
  "/docs/designs/execute-code-runtimes/": "/docs/tools/execute-code/",
  "/docs/designs/probe-architecture/": "/docs/",
  "/docs/designs/desktop-companion/": "/docs/",
  "/docs/designs/issue-1-migration-plan/": "/docs/",

  // concepts → product / cognition
  "/docs/concepts/architecture/": "/docs/product/architecture/",
  "/docs/concepts/identity/": "/docs/product/identity/",
  "/docs/concepts/entity-model/": "/docs/product/entity-model/",
  "/docs/concepts/anima-uri/": "/docs/product/anima-uri/",
  "/docs/concepts/compression/": "/docs/cognition/compression/",
  "/docs/concepts/dream/": "/docs/cognition/dream/",
  "/docs/concepts/environment-awareness/": "/docs/cognition/environment-awareness/",
  "/docs/concepts/memory/": "/docs/cognition/memory/",
  "/docs/concepts/notifications/": "/docs/cognition/notifications/",
  "/docs/concepts/recall-flow/": "/docs/cognition/recall-flow/",
  "/docs/concepts/self-layer/": "/docs/cognition/self-layer/",
  "/docs/concepts/sleep/": "/docs/cognition/sleep/",
  "/docs/concepts/temporal-summary/": "/docs/cognition/temporal-summary/",
  "/docs/concepts/time-perception/": "/docs/cognition/time-perception/",
  "/docs/concepts/repository-topology/": "/docs/",

  // features → modules
  "/docs/features/chat/": "/docs/modules/chat/",
  "/docs/features/companion/": "/docs/modules/companion/",
  "/docs/features/companion-settings/": "/docs/modules/companion/",
  "/docs/features/diary/": "/docs/modules/diary/",
  "/docs/features/goal/": "/docs/modules/goal/",
  "/docs/features/mobile-app/": "/docs/modules/mobile-app/",
  "/docs/features/page-refresh/": "/docs/modules/page-refresh/",
  "/docs/features/project/": "/docs/modules/project/",
  "/docs/features/tauri-companion-acceptance/": "/docs/modules/companion/",
  "/docs/features/tauri-companion-%E9%AA%8C%E6%94%B6/": "/docs/modules/companion/",

  // guide → ops / modules
  "/docs/guide/database/": "/docs/ops/database/",
  "/docs/guide/habitat-rpc/": "/docs/ops/habitat-rpc/",
  "/docs/guide/install/": "/docs/ops/install/",
  "/docs/guide/message-gateway/": "/docs/ops/message-gateway/",
  "/docs/guide/remote-access/": "/docs/ops/remote-access/",
  "/docs/guide/security/": "/docs/ops/security/",
  "/docs/guide/service/": "/docs/ops/service/",
  "/docs/guide/offline-platform/": "/docs/modules/offline-platform/",

  // tools renames
  "/docs/tools/browser-camofox/": "/docs/tools/browser/",
  "/docs/tools/execute-code-runtimes/": "/docs/tools/execute-code/",
};

export const docRedirects: Record<string, string> = Object.fromEntries(
  Object.entries(docMoves).flatMap(([from, to]) => [
    [from, to],
    [`/zh-cn${from}`, `/zh-cn${to}`],
  ]),
);
