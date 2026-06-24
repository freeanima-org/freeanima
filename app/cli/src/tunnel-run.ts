import { existsSync, readFileSync } from "node:fs";

/** Cloudflare 远程托管隧道返回的 connector token（非 AccountTag JSON） */
export function readTunnelConnectorToken(credentialsFile: string): string | null {
  if (!existsSync(credentialsFile)) return null;
  const raw = readFileSync(credentialsFile, "utf-8").trim();
  if (!raw || raw.startsWith("{")) return null;
  return raw;
}

export function cloudflaredRunArgv(
  cloudflaredBin: string,
  opts: { credentialsFile: string; configFile: string; tunnelId?: string },
): string[] {
  if (readTunnelConnectorToken(opts.credentialsFile)) {
    return [cloudflaredBin, "tunnel", "run", "--token-file", opts.credentialsFile];
  }
  const args = [cloudflaredBin, "tunnel", "--config", opts.configFile, "run"];
  if (opts.tunnelId) args.push(opts.tunnelId);
  return args;
}

export function cloudflaredRunExecStart(
  cloudflaredBin: string,
  opts: { credentialsFile: string; configFile: string; tunnelId?: string },
): string {
  if (readTunnelConnectorToken(opts.credentialsFile)) {
    return `${cloudflaredBin} tunnel run --token-file ${shellQuote(opts.credentialsFile)}`;
  }
  const tunnelArg = opts.tunnelId ? ` ${shellQuote(opts.tunnelId)}` : "";
  return `${cloudflaredBin} tunnel --config ${shellQuote(opts.configFile)} run${tunnelArg}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
