import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { CODING_APP_ID } from "@freeanima/shared/coding/constants.ts";
import type { StreamApiLikeEvent } from "@freeanima/shared/rpc-contract/frames/message.ts";
import type { RpcStreamClient } from "@freeanima/shared/rpc-contract/router.ts";
import type { SapSessionStreamClient } from "@freeanima/shared/rpc-contract/conversation-stream-core.ts";
import { asRecord } from "@freeanima/shared/util";

import { pickCodingOutpostInstance, type HabitatClientSession } from "./habitat-connect.ts";
import { listCodingOutposts } from "./outposts-api.ts";
import {
  discoverLocalProjectContext,
  syncProjectContextToHabitatRpc,
} from "./project-context-sync.ts";
import {
  connectSshCodingRemote,
  createNodeSshProcessRunner,
  parseSshRemoteTarget,
} from "@freeanima/shared/coding/ssh-remote";

function printStreamEvent(ev: StreamApiLikeEvent): void {
  switch (ev.event) {
    case "token":
      process.stdout.write(ev.data.content);
      break;
    case "content_replace":
      process.stdout.write(`\n${ev.data.content}`);
      break;
    case "tool_begin": {
      const title = typeof ev.data.args._title === "string" ? ev.data.args._title : ev.data.tool;
      console.log(`\n› tool ${ev.data.tool}${title ? ` — ${title}` : ""}`);
      break;
    }
    case "tool_result": {
      const preview = ev.data.content.replace(/\s+/g, " ").slice(0, 240);
      console.log(`‹ result ${ev.data.tool}: ${preview}${ev.data.content.length > 240 ? "…" : ""}`);
      break;
    }
    case "tool_error":
      console.error(`‹ error ${ev.data.tool}: ${ev.data.content}`);
      break;
    case "error":
      console.error(`\n[error] ${ev.data.error}`);
      break;
    case "done":
      process.stdout.write("\n");
      break;
    case "interrupted":
      console.error(`\n[interrupted] ${ev.data.reason}`);
      break;
    default:
      break;
  }
}

async function sendOne(
  stream: SapSessionStreamClient,
  conversationId: string,
  message: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.sendMessageStream(
      { conversationId, message },
      {
        onData: printStreamEvent,
        onError: (err) => reject(err),
        onComplete: () => resolve(),
      },
    );
  });
}

async function createCodingConversation(
  rpc: RpcStreamClient,
  opts: { instanceId: string; workspaceRoot: string | null },
): Promise<string> {
  const created = await rpc.request("conversation.create", {
    platform: "coding",
    scenario: "coding_agent",
    outpost_app_id: CODING_APP_ID,
    outpost_instance_id: opts.instanceId,
    ...(opts.workspaceRoot ? { workspace_root: opts.workspaceRoot } : {}),
  });
  return created.conversation_id;
}

async function listCodingConversations(
  rpc: RpcStreamClient,
  limit: number,
): Promise<Array<{ conversation_id: string; title: string }>> {
  const out = await rpc.request("conversation.list", {
    platform: "coding",
    limit,
  });
  return out.conversations.map((c) => ({
    conversation_id: c.conversation_id,
    title: c.title?.trim() || "(无标题)",
  }));
}

async function printRecentMessages(
  rpc: RpcStreamClient,
  conversationId: string,
  limit = 8,
): Promise<void> {
  const raw = await rpc.request("conversation.messages", {
    conversation_id: conversationId,
    limit,
  });
  const record = asRecord(raw);
  // conversation.messages → MessagesDisplay.display
  const msgs = Array.isArray(record?.display)
    ? record.display
    : Array.isArray(raw)
      ? raw
      : Array.isArray(record?.messages)
        ? record.messages
        : [];
  if (msgs.length === 0) return;
  console.log("--- 最近消息 ---");
  for (const m of msgs) {
    const r = asRecord(m);
    const role = typeof r?.role === "string" ? r.role : "?";
    let content = "";
    if (typeof r?.content === "string") content = r.content;
    else if (typeof r?.text === "string") content = r.text;
    else if (r?.content != null) content = JSON.stringify(r.content);
    const line = content.replace(/\s+/g, " ").slice(0, 160);
    console.log(`[${role}] ${line}${content.length > 160 ? "…" : ""}`);
  }
  console.log("---------------");
}

export type RunCodingTuiOptions = {
  session: HabitatClientSession;
  conversationId?: string | null;
  workspaceRoot?: string | null;
  instanceId?: string | null;
  /** 非交互：发一条后退出 */
  message?: string | null;
  listOnly?: boolean;
  limit?: number;
  /** 本机无 probe 时自动 spawn；默认 true（SSH 模式忽略） */
  autoSpawnProbe?: boolean;
  /** SSH Remote：编排远端 probe 后绑会话 */
  ssh?: {
    target: string;
    port?: number;
    identityFile?: string;
  } | null;
};

export async function runCodingTui(opts: RunCodingTuiOptions): Promise<void> {
  const { session } = opts;
  const { rpc, stream } = session;
  const limit = opts.limit ?? 50;

  if (opts.listOnly) {
    const rows = await listCodingConversations(rpc, limit);
    if (rows.length === 0) {
      console.log("（无 coding 会话）");
      return;
    }
    for (const row of rows) {
      console.log(`${row.conversation_id}\t${row.title}`);
    }
    return;
  }

  const sshSpec = opts.ssh;
  let outpost: { instance_id: string; tool_count: number };
  let workspaceRoot = opts.workspaceRoot?.trim() || null;
  let tunnelHandleId: string | null = null;
  const runner = createNodeSshProcessRunner();

  if (sshSpec?.target) {
    if (!workspaceRoot) {
      throw new Error("SSH 模式需要 --workspace <远端绝对路径>");
    }
    const target = parseSshRemoteTarget({
      ssh: sshSpec.target,
      remoteWorkspace: workspaceRoot,
      ...(sshSpec.port != null ? { port: sshSpec.port } : {}),
      ...(sshSpec.identityFile ? { identityFile: sshSpec.identityFile } : {}),
    });
    console.error(
      `[anima-client] SSH Remote ${target.user}@${target.host}${target.port ? `:${target.port}` : ""} → ${target.remoteWorkspace}`,
    );
    const remote = await connectSshCodingRemote({
      runner,
      habitatUrl: session.habitatUrl,
      token: session.token,
      target,
      listCodingOutposts: () =>
        listCodingOutposts({ habitatUrl: session.habitatUrl, token: session.token }),
      ...(opts.instanceId != null ? { preferInstanceId: opts.instanceId } : {}),
    });
    tunnelHandleId = remote.tunnel?.handleId ?? null;
    outpost = { instance_id: remote.instanceId, tool_count: -1 };
    workspaceRoot = target.remoteWorkspace;
  } else {
    outpost = await pickCodingOutpostInstance({
      habitatUrl: session.habitatUrl,
      token: session.token,
      ...(opts.instanceId != null ? { preferredInstanceId: opts.instanceId } : {}),
      autoSpawn: opts.autoSpawnProbe !== false,
      ...(workspaceRoot != null ? { workspaceRoot } : {}),
    });
  }
  console.error(
    `[anima-client] probe instance_id=${outpost.instance_id} tools=${outpost.tool_count}`,
  );

  let conversationId = opts.conversationId?.trim() || "";
  if (!conversationId) {
    conversationId = await createCodingConversation(rpc, {
      instanceId: outpost.instance_id,
      workspaceRoot,
    });
    console.error(`[anima-client] 新建会话 ${conversationId}`);
  } else {
    console.error(`[anima-client] 复用会话 ${conversationId}`);
    await printRecentMessages(rpc, conversationId);
  }

  // SSH 远端：projectContext 由 probe/Agent 工具发现；本机 discover 仅本地路径
  if (workspaceRoot && !sshSpec?.target) {
    try {
      const snapshot = await discoverLocalProjectContext(workspaceRoot);
      const rawRpc = session.transport.getClient();
      if (rawRpc) {
        await syncProjectContextToHabitatRpc(rawRpc, {
          conversationId,
          snapshot,
        });
        console.error(`[anima-client] 已 sync 项目上下文（rules=${snapshot.rules.length}）`);
      }
    } catch (e) {
      console.error(
        `[anima-client] projectContextSync 失败：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  try {
    const oneShot = opts.message?.trim();
    if (oneShot) {
      await sendOne(stream, conversationId, oneShot);
      return;
    }

    console.error(
      "编码 TUI：输入消息回车发送；空行或 /quit 退出。进度来自 Habitat 流（probe 直连执行）。",
    );
    const rl = readline.createInterface({ input, output });
    try {
      for (;;) {
        const line = (await rl.question("you> ")).trim();
        if (!line || line === "/quit" || line === "/exit") break;
        if (line === "/help") {
          console.log("/quit 退出；其余文本发给 Agent。");
          continue;
        }
        try {
          process.stdout.write("assistant> ");
          await sendOne(stream, conversationId, line);
        } catch (e) {
          console.error(e instanceof Error ? e.message : String(e));
        }
      }
    } finally {
      rl.close();
    }
  } finally {
    if (tunnelHandleId) {
      await runner.stopDetached(tunnelHandleId).catch(() => {});
    }
  }
}
