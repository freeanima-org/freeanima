import {
  isFullTokenAuthorization,
  moduleFromRpcMethod,
  tokenAllowsModule,
  tokenDataCapability,
  assertDataCapability,
  DataCapabilityError,
  type ServiceApiTokenAuthorization,
} from "@freeanima/shared/service-api-auth";

export class TokenAuthorizationError extends Error {
  readonly code:
    | "module_denied"
    | "access_denied"
    | "full_required"
    | "component_denied"
    | "world_denied";
  readonly httpStatus = 403;

  constructor(code: TokenAuthorizationError["code"], message: string) {
    super(message);
    this.name = "TokenAuthorizationError";
    this.code = code;
  }
}

const FULL_REQUIRED_MODULES = new Set(["tokens"]);

export type AssertTokenRpcAccessOpts = {
  method: string;
  authorization: ServiceApiTokenAuthorization;
  /** dualTransportMeta(readOnly) → read；写操作 write */
  access: "read" | "write";
};

/**
 * RPC 分发前：full 放行；否则检查 module + data.access。
 * tokens.* 等管理面要求 full。
 */
export function assertTokenRpcAccess(opts: AssertTokenRpcAccessOpts): void {
  const { method, authorization, access } = opts;
  const module = moduleFromRpcMethod(method);

  if (FULL_REQUIRED_MODULES.has(module)) {
    if (!isFullTokenAuthorization(authorization)) {
      throw new TokenAuthorizationError(
        "full_required",
        `method ${method} requires full authorization`,
      );
    }
    return;
  }

  if (isFullTokenAuthorization(authorization)) return;

  if (!tokenAllowsModule(authorization, module)) {
    throw new TokenAuthorizationError(
      "module_denied",
      `module ${module} not allowed by token authorization`,
    );
  }

  const data = tokenDataCapability(authorization);
  if (!data) return;
  try {
    assertDataCapability(data, { access });
  } catch (e) {
    if (e instanceof DataCapabilityError) {
      throw new TokenAuthorizationError(
        e.code === "access_denied" ? "access_denied" : e.code,
        e.message,
      );
    }
    throw e;
  }
}
