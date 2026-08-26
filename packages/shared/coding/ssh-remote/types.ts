/** SSH Remote 目标与会话（桌面 / anima-client 共用） */

export type SshRemoteTarget = {
  user: string;
  host: string;
  port?: number;
  identityFile?: string;
  remoteWorkspace: string;
};

export type SshTunnelInfo = {
  /** 远端 probe 应使用的 Habitat URL（经反向隧道映射） */
  habitatUrlForProbe: string;
  /** 本机 ssh -N -R 进程句柄 id（由 runner 解释） */
  handleId: string;
};

export type SshRemoteSession = {
  instanceId: string;
  target: SshRemoteTarget;
  tunnel?: SshTunnelInfo;
};

export type SshRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/** 可注入的本机进程执行面（CLI=Bun.spawn；桌面=Tauri invoke） */
export type SshProcessRunner = {
  run(
    command: string,
    args: readonly string[],
    opts?: { timeoutMs?: number; env?: Record<string, string> },
  ): Promise<SshRunResult>;
  /** 后台进程（ssh -N 隧道）；返回可 stop 的 handleId */
  spawnDetached(
    command: string,
    args: readonly string[],
    opts?: { env?: Record<string, string> },
  ): Promise<{ handleId: string }>;
  stopDetached(handleId: string): Promise<void>;
};

export type ListCodingOutpostFn = () => Promise<Array<{ instance_id: string; tool_count: number }>>;
