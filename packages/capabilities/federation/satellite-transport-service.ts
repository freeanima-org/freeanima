import { Service, type Context } from "cordis";

export type SatelliteTransport = {
  sendRaw: (data: string) => void;
  onFrame: (handler: (method: string, payload: unknown) => void) => () => void;
};

declare module "cordis" {
  interface Context {
    satelliteFederationTransport: SatelliteFederationTransportService;
  }
}

/**
 * Cordis service (`ctx.satelliteFederationTransport`) holding the satellite RPC
 * transport bound by the federation client. Replaces the module-level singleton
 * in `federation/satellite-rpc.ts`.
 */
export class SatelliteFederationTransportService extends Service {
  private transport: SatelliteTransport | null = null;

  constructor(ctx: Context) {
    super(ctx, "satelliteFederationTransport");
  }

  bind(next: SatelliteTransport | null): void {
    this.transport = next;
  }

  get(): SatelliteTransport | null {
    return this.transport;
  }

  reset(): void {
    this.transport = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountSatelliteFederationTransportService(
  ctx: Context,
): SatelliteFederationTransportService {
  const existing = ctx.satelliteFederationTransport as
    | SatelliteFederationTransportService
    | undefined;
  if (existing) return existing;
  return new SatelliteFederationTransportService(ctx);
}
