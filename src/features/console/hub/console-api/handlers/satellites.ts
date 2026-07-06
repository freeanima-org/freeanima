import { consoleCtx } from "./runtime.ts";

export async function getSatellitesStatus() {
  const { satellite } = consoleCtx();
  if (!satellite) {
    return {
      instance_count: 0,
      tool_count: 0,
      instances: [],
    };
  }
  return satellite.getStatus();
}
