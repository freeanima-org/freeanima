import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import type { AppRouter } from "@freeanima/connectors-webui/trpc";
import { apiPath, trpcWsUrl } from "./api-path.ts";

const wsClient = createWSClient({
  url: trpcWsUrl(),
});

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.path.startsWith("studio.terminal"),
      true: wsLink({ client: wsClient }),
      false: splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({ url: apiPath("/api/trpc") }),
        false: httpBatchLink({ url: apiPath("/api/trpc") }),
      }),
    }),
  ],
});
