import { router } from "./trpc.ts";
import { acpRouter } from "./routers/acp.ts";
import { healthRouter } from "./routers/health.ts";
import { memoryRouter } from "./routers/memory.ts";
import { messagesRouter } from "./routers/messages.ts";
import { mcpRouter } from "./routers/mcp.ts";
import { sessionsRouter } from "./routers/sessions.ts";
import { statusRouter } from "./routers/status.ts";
import { studioRouter, terminalEventSchema } from "./routers/studio.ts";

export const appRouter = router({
  health: healthRouter,
  sessions: sessionsRouter,
  messages: messagesRouter,
  status: statusRouter,
  memory: memoryRouter,
  mcp: mcpRouter,
  acp: acpRouter,
  studio: studioRouter,
});

export type AppRouter = typeof appRouter;

export { terminalEventSchema };
