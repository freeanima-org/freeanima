/** Habitat URL 主机是否为 loopback（需反向隧道） */
export function isLoopbackHabitatUrl(habitatUrl: string): boolean {
  try {
    const u = new URL(habitatUrl.includes("://") ? habitatUrl : `http://${habitatUrl}`);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function habitatLocalPort(habitatUrl: string): number {
  try {
    const u = new URL(habitatUrl.includes("://") ? habitatUrl : `http://${habitatUrl}`);
    if (u.port) return Number(u.port);
    return u.protocol === "https:" ? 443 : 80;
  } catch {
    return 2658;
  }
}

/** 远端 probe 经 ssh -R 映射后使用的 URL */
export function mappedLoopbackHabitatUrl(remotePort: number, originalUrl: string): string {
  let protocol = "http:";
  try {
    protocol = new URL(originalUrl.includes("://") ? originalUrl : `http://${originalUrl}`)
      .protocol;
  } catch {
    /* keep http */
  }
  return `${protocol}//127.0.0.1:${remotePort}`;
}

export { sshBaseArgs as buildSshBaseArgs } from "./ssh-exec.ts";
