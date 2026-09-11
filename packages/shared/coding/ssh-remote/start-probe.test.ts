import { describe, expect, it } from "bun:test";

import { startRemoteCodingProbe } from "./start-probe.ts";
import type { SshProcessRunner, SshRemoteTarget } from "./types.ts";

describe("startRemoteCodingProbe", () => {
  it("separates directory creation from the detached probe command", async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const runner: SshProcessRunner = {
      async run(command, args) {
        calls.push({ command, args });
        return { stdout: "1234\n", stderr: "", exitCode: 0 };
      },
      async spawnDetached() {
        return { handleId: "unused" };
      },
      async stopDetached() {},
    };
    const target: SshRemoteTarget = {
      user: "grass",
      host: "galaxy",
      remoteWorkspace: "/home/grass/work space/freeanima",
    };

    await startRemoteCodingProbe(runner, target, {
      habitatUrl: "http://127.0.0.1:2658",
      token: "token with space",
      remoteProbeCommand: "/home/grass/.anima/bin/anima-probe",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("ssh");
    const remoteCommand = calls[0]?.args.at(-1);
    expect(remoteCommand).toContain(
      "mkdir -p $HOME/.anima/outpost/coding && nohup '/home/grass/.anima/bin/anima-probe'",
    );
    expect(remoteCommand).toContain("--habitat-url 'http://127.0.0.1:2658'");
    expect(remoteCommand).toContain("--token 'token with space'");
    expect(remoteCommand).toContain("--workspace '/home/grass/work space/freeanima'");
    expect(remoteCommand).toEndWith(">> $HOME/.anima/outpost/coding/probe.log 2>&1 & echo $!");
  });
});
