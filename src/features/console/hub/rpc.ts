/** Console Hub RPC — re-export from console-api（WS dispatch 与 Elysia 薄路由共用） */
export {
  consoleHubHandlers,
  invokeConsoleHubHandler,
  type ConsoleHubMethod,
} from "./console-api/console-hub-handlers.ts";
