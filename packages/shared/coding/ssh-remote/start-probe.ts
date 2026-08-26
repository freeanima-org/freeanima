import { sshBaseArgs, sshRun } from "./ssh-exec.ts";
import { formatSshDestination } from "./parse-target.ts";
import { habitatLocalPort, isLoopbackHabitatUrl, mappedLoopbackHabitatUrl } from "./tunnel.ts";
import type { SshProcessRunner, SshRemoteTarget, SshTunnelInfo } from "./types.ts";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** 若 Habitat 为 loopback，建立 ssh -R 反向隧道并返回远端可用 URL */
export async function maybeStartReverseTunnel(
  runner: SshProcessRunner,
  target: SshRemoteTarget,
  habitatUrl: string,
): Promise<SshTunnelInfo | null> {
  if (!isLoopbackHabitatUrl(habitatUrl)) return null;
  const localPort = habitatLocalPort(habitatUrl);
  // 远端固定映射同端口，避免冲突时由用户换 Habitat 端口
  const remotePort = localPort;
  const args = [
    ...sshBaseArgs(target),
    "-N",
    "-R",
    `${remotePort}:127.0.0.1:${localPort}`,
    formatSshDestination(target),
  ];
  const { handleId } = await runner.spawnDetached("ssh", args);
  return {
    habitatUrlForProbe: mappedLoopbackHabitatUrl(remotePort, habitatUrl),
    handleId,
  };
}

export async function startRemoteCodingProbe(
  runner: SshProcessRunner,
  target: SshRemoteTarget,
  opts: {
    habitatUrl: string;
    token: string;
    remoteProbeCommand: string;
  },
): Promise<void> {
  const logFile = "$HOME/.anima/outpost/coding/probe.log";
  const cmd = [
    "mkdir -p $HOME/.anima/outpost/coding",
    `nohup ${shellQuote(opts.remoteProbeCommand)}`,
    `--habitat-url ${shellQuote(opts.habitatUrl)}`,
    `--token ${shellQuote(opts.token)}`,
    `--workspace ${shellQuote(target.remoteWorkspace)}`,
    `>> ${logFile} 2>&1 &`,
    "echo $!",
  ].join(" ");

  const started = await sshRun(runner, target, cmd, { timeoutMs: 30_000 });
  if (started.exitCode !== 0) {
    throw new Error(`启动远端 anima-probe 失败：${started.stderr || started.stdout}`);
  }
}
