export type {
  ListCodingOutpostFn,
  SshProcessRunner,
  SshRemoteSession,
  SshRemoteTarget,
  SshRunResult,
  SshTunnelInfo,
} from "./types.ts";

export {
  formatSshDestination,
  parseSshRemoteTarget,
  type ParseSshTargetInput,
} from "./parse-target.ts";
export {
  habitatLocalPort,
  isLoopbackHabitatUrl,
  mappedLoopbackHabitatUrl,
  buildSshBaseArgs,
} from "./tunnel.ts";
export { sshRun, scpToRemote } from "./ssh-exec.ts";
export { ensureRemoteAnimaProbe, resolveLocalProbeBinary } from "./ensure-probe.ts";
export { maybeStartReverseTunnel, startRemoteCodingProbe } from "./start-probe.ts";
export {
  connectSshCodingRemote,
  targetFromCliFlags,
  type ConnectSshCodingRemoteOpts,
} from "./orchestrate.ts";
export { createNodeSshProcessRunner } from "./node-runner.ts";
