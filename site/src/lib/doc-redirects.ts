/** 301 redirects for docs paths moved in the v2 restructure. */
const docMoves: Record<string, string> = {
  "/docs/identity/": "/docs/concepts/identity/",
  "/docs/self-layer/": "/docs/concepts/self-layer/",
  "/docs/memory/": "/docs/concepts/memory/",
  "/docs/compression/": "/docs/concepts/compression/",
  "/docs/sleep/": "/docs/concepts/sleep/",
  "/docs/security/": "/docs/guide/security/",
  "/docs/database/": "/docs/guide/database/",
  "/docs/versioning/": "/docs/guide/versioning/",
  "/docs/designs/recall-flow/": "/docs/concepts/recall-flow/",
  "/docs/designs/time-perception/": "/docs/concepts/time-perception/",
  "/docs/designs/pair-programming-v1/": "/docs/features/pair-programming-v1/",
  "/docs/designs/execute-code-runtimes/": "/docs/tools/execute-code-runtimes/",
  "/docs/designs/probe-architecture/": "/docs/",
  "/docs/designs/desktop-companion/": "/docs/",
  "/docs/designs/issue-1-migration-plan/": "/docs/",
};

export const docRedirects: Record<string, string> = Object.fromEntries(
  Object.entries(docMoves).flatMap(([from, to]) => [
    [from, to],
    [`/zh-cn${from}`, `/zh-cn${to}`],
  ]),
);
