import { Context, Service } from "cordis";

export type ShellSendRequest = (method: string, payload: unknown) => Promise<unknown>;

declare module "cordis" {
  interface Context {
    vaultShellSendRequest: VaultShellSendRequestService;
  }
}

/**
 * Cordis service (`ctx.vaultShellSendRequest`) holding the shell request bridge
 * bound by the outpost WS server. Replaces the module-level singleton in
 * `connectors/vault/user-secrets.ts`.
 */
export class VaultShellSendRequestService extends Service {
  private fn: ShellSendRequest | null = null;

  constructor(ctx: Context) {
    super(ctx, "vaultShellSendRequest");
  }

  bind(fn: ShellSendRequest | null): void {
    this.fn = fn;
  }

  get(): ShellSendRequest | null {
    return this.fn;
  }

  reset(): void {
    this.fn = null;
  }
}

let current: VaultShellSendRequestService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureVaultShellSendRequestService(): VaultShellSendRequestService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new VaultShellSendRequestService(ownedCtx);
  }
  return current;
}

export function currentVaultShellSendRequestService(): VaultShellSendRequestService | null {
  return current;
}

/** Test teardown。 */
export function resetVaultShellSendRequestServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
