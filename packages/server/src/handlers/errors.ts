import { logApiError } from "@freeanima/legacy-kernel";

export class ApiHandlerError extends Error {
  readonly status: 400 | 404 | 500 | 503;
  readonly context?: Record<string, unknown>;

  constructor(
    status: 400 | 404 | 500 | 503,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiHandlerError";
    this.status = status;
    this.context = context;
  }
}

export function logHandlerError(
  method: string,
  path: string,
  err: unknown,
  context?: Record<string, unknown>,
): never {
  if (err instanceof ApiHandlerError) {
    logApiError(method, path, err.status, err.message, err.context ?? context);
    throw err;
  }
  const message = String(err);
  logApiError(method, path, 500, message, context);
  throw new ApiHandlerError(500, message, context);
}

export function jsonError(status: 400 | 404 | 500 | 503, message: string): Response {
  return Response.json({ error: message }, { status });
}
