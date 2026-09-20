import { Context, Service } from "cordis";

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

let current: SatelliteFederationTransportService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureSatelliteFederationTransportService(): SatelliteFederationTransportService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new SatelliteFederationTransportService(ownedCtx);
  }
  return current;
}

export function currentSatelliteFederationTransportService(): SatelliteFederationTransportService | null {
  return current;
}

/** Test teardown。 */
export function resetSatelliteFederationTransportServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
