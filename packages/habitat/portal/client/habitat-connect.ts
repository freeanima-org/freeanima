import {
  createSapConversationStreamClient,
  type SapSessionStreamClient,
} from "@freeanima/shared/rpc-contract/conversation-stream-core.ts";
import { sapClientFromRpc } from "@freeanima/shared/rpc-contract/rpc-stream-client-from-rpc.ts";
import type { RpcStreamClient } from "@freeanima/shared/rpc-contract/router.ts";
import {
  runHabitatRpcTransport,
  type HabitatRpcTransportHandle,
} from "@freeanima/shared/habitat-rpc";

import { ensureLocalCodingProbe } from "./probe-local.ts";
import { listCodingOutposts, type CodingOutpostInstance } from "./outposts-api.ts";

export type { CodingOutpostInstance } from "./outposts-api.ts";
export { listCodingOutposts } from "./outposts-api.ts";

export type HabitatClientSession = {
  transport: HabitatRpcTransportHandle;
  rpc: RpcStreamClient;
  stream: SapSessionStreamClient;
  habitatUrl: string;
  token: string;
  stop: () => void;
};

export async function connectHabitatClient(opts: {
  habitatUrl: string;
  token: string;
}): Promise<HabitatClientSession> {
  const habitatUrl = opts.habitatUrl.replace(/\/$/, "");
  let rpcClient: RpcStreamClient | null = null;
  const transport = runHabitatRpcTransport({
    habitatUrl,
    authToken: opts.token,
    onConnected: (rpc) => {
      rpcClient = sapClientFromRpc(rpc);
    },
  });

  const whenRpc = async (): Promise<RpcStreamClient> => {
    await transport.whenConnected();
    if (!rpcClient) {
      const raw = transport.getClient();
      if (!raw) throw new Error("Habitat RPC 未连接");
      rpcClient = sapClientFromRpc(raw);
    }
    return rpcClient;
  };

  await whenRpc();
  const stream = createSapConversationStreamClient(whenRpc);
  return {
    transport,
    rpc: await whenRpc(),
    stream,
    habitatUrl,
    token: opts.token,
    stop: () => {
      stream.detach();
      transport.stop();
    },
  };
}

export type PickCodingOutpostOptions = {
  habitatUrl: string;
  token: string;
  preferredInstanceId?: string | null;
  /** 本机无 attach 时自动 spawn anima-probe；默认 true */
  autoSpawn?: boolean;
  workspaceRoot?: string | null;
};

export async function pickCodingOutpostInstance(
  opts: PickCodingOutpostOptions,
): Promise<CodingOutpostInstance> {
  const habitatOpts = { habitatUrl: opts.habitatUrl, token: opts.token };
  const list = await listCodingOutposts(habitatOpts);

  const want = opts.preferredInstanceId?.trim();
  if (want) {
    const hit = list.find((x) => x.instance_id === want);
    if (hit) return hit;
    if (list.length > 0) {
      throw new Error(
        `指定 instance_id=${want} 未在线；在线: ${list.map((x) => x.instance_id).join(", ")}`,
      );
    }
    throw new Error(`指定 instance_id=${want} 未在线，且当前无 coding 前哨 attach`);
  }

  if (list.length === 0) {
    if (opts.autoSpawn === false) {
      throw new Error(
        "未发现 coding 前哨。请手动启动 anima-probe，或去掉 --no-spawn-probe 以自动启动。",
      );
    }
    return ensureLocalCodingProbe({
      habitatUrl: opts.habitatUrl,
      token: opts.token,
      workspaceRoot: opts.workspaceRoot?.trim() || process.cwd(),
    });
  }

  if (list.length > 1) {
    console.error(
      `[anima-client] 多个 coding probe，选用第一个 ${list[0]?.instance_id}（可用 --instance-id 指定）`,
    );
  }
  const first = list[0];
  if (!first) {
    throw new Error("未发现 coding 前哨");
  }
  return first;
}
