import { Service, type Context } from "cordis";

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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountVaultShellSendRequestService(ctx: Context): VaultShellSendRequestService {
  const existing = ctx.vaultShellSendRequest as VaultShellSendRequestService | undefined;
  if (existing) return existing;
  return new VaultShellSendRequestService(ctx);
}
