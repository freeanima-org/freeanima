import { formatSshDestination } from "./parse-target.ts";
import type { SshProcessRunner, SshRemoteTarget, SshRunResult } from "./types.ts";

function sshBaseArgs(target: SshRemoteTarget): string[] {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=15",
  ];
  if (target.port != null) {
    args.push("-p", String(target.port));
  }
  if (target.identityFile) {
    args.push("-i", target.identityFile);
  }
  return args;
}

function scpBaseArgs(target: SshRemoteTarget): string[] {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=15",
  ];
  if (target.port != null) {
    args.push("-P", String(target.port));
  }
  if (target.identityFile) {
    args.push("-i", target.identityFile);
  }
  return args;
}

export async function sshRun(
  runner: SshProcessRunner,
  target: SshRemoteTarget,
  remoteCommand: string,
  opts?: { timeoutMs?: number },
): Promise<SshRunResult> {
  return runner.run(
    "ssh",
    [...sshBaseArgs(target), formatSshDestination(target), remoteCommand],
    opts,
  );
}

export async function scpToRemote(
  runner: SshProcessRunner,
  target: SshRemoteTarget,
  localPath: string,
  remotePath: string,
  opts?: { timeoutMs?: number },
): Promise<SshRunResult> {
  return runner.run(
    "scp",
    [...scpBaseArgs(target), localPath, `${formatSshDestination(target)}:${remotePath}`],
    opts,
  );
}

export { sshBaseArgs };
