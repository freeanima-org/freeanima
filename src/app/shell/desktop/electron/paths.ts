import { homedir } from "node:os";
import { join } from "node:path";

export function satelliteInstancePath(appId: string, home = process.env.FREEANIMA_HOME): string {
  const root = home?.trim() || join(homedir(), ".anima");
  return join(root, "src/satellites", appId, "instance.json");
}

export function defaultHubUrl(): string {
  return (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}
