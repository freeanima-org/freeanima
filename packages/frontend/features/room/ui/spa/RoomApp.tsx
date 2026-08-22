import { useCallback, useEffect, useMemo, useState } from "react";
import { Ellipsis, Plus } from "lucide-react";
import { Button, Input } from "@freeanima/ui-kit";
import { ModalSheetPresent, StatusAlert, toast } from "@freeanima/ui-kit/composite";
import { ListDetailLayout, useCompactLayout, useDrawerNav } from "@freeanima/ui-kit/layout";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import type {
  RoomMessagePayload,
  RoomSummaryPayload,
} from "@freeanima/shared/rpc-contract/frames/room.ts";
import { loadResolvedWorldContext } from "@freeanima/client/portal-sdk/world-context.ts";
import {
  ChatComposeForm,
  type ChatComposeSendPayload,
} from "@freeanima/features/chat/ui/spa/components/ChatComposeForm.tsx";
import { SlashCommandResultPanel } from "@freeanima/features/chat/ui/spa/components/SlashCommandResultPanel.tsx";
import type { AtMentionCandidate } from "@freeanima/features/chat/ui/spa/lib/at-mention-menu.ts";
import {
  listConversationCommands,
  runConversationCommand,
} from "@freeanima/features/chat/ui/spa/lib/conversation-command-api.ts";
import type { SlashCommandItem } from "@freeanima/features/chat/ui/spa/lib/slash-command-menu.ts";

import * as api from "./lib/api.ts";
import {
  extractAnimaEntityIds,
  publicIdFromEntityId,
  publicIdsFromEntityIds,
} from "./lib/member-public-ids.ts";
import { RoomInfoSheet } from "./RoomInfoSheet.tsx";
import { RoomMemberChecklist } from "./RoomMemberChecklist.tsx";
import { RoomTranscript } from "./RoomTranscript.tsx";

import { asRecord } from "@freeanima/shared/util";

function weakLabel(publicId: string, display?: string): string {
  if (display?.trim()) return display.trim();
  if (publicId.length <= 10) return publicId;
  return `${publicId.slice(0, 6)}…`;
}

function readCommandList(raw: unknown): SlashCommandItem[] {
  const rec = asRecord(raw);
  const commands = rec?.commands;
  if (!Array.isArray(commands)) return [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- commands 列表契约边界
  return commands as SlashCommandItem[];
}

export function RoomApp() {
  const compact = useCompactLayout();
  const drawerNav = useDrawerNav();
  const [listOpen, setListOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummaryPayload[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSummaryPayload | null>(null);
  const [messages, setMessages] = useState<RoomMessagePayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userPublicId, setUserPublicId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [streamDraft, setStreamDraft] = useState<{
    agent_public_id: string;
    text: string;
  } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("新群聊");
  const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState<number[]>([]);
  const [commandList, setCommandList] = useState<SlashCommandItem[]>([]);
  const [slashResult, setSlashResult] = useState<{
    command: string;
    text: string;
    loading?: boolean;
  } | null>(null);

  const refreshList = useCallback(async () => {
    const data = await api.roomList();
    setRooms(data.rooms);
  }, []);

  const loadRoom = useCallback(async (roomId: string) => {
    const [r, msgs] = await Promise.all([api.roomGet(roomId), api.roomMessagesList(roomId)]);
    setRoom(r);
    setMessages(msgs);
    setActiveId(roomId);
    setListOpen(false);
  }, []);

  const followAgentStream = useCallback(
    async (roomId: string, turn: { agent_public_id: string; stream_id: string }): Promise<void> => {
      setStreamDraft({ agent_public_id: turn.agent_public_id, text: "" });
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        api.attachRoomAgentStream(turn.stream_id, {
          onToken: (text) => setStreamDraft({ agent_public_id: turn.agent_public_id, text }),
          onDone: finish,
          onError: (message) => {
            setError(message);
            finish();
          },
        });
      });
      setStreamDraft(null);
      await loadRoom(roomId);
    },
    [loadRoom],
  );

  useEffect(() => {
    void (async () => {
      try {
        const ctx = await loadResolvedWorldContext();
        const pid = await publicIdFromEntityId(ctx.user_subject_id);
        setUserPublicId(pid);
        await refreshList();
      } catch (e) {
        setError(String(e));
      }
    })();
    void listConversationCommands({ platform: "chat" })
      .then((raw) => setCommandList(readCommandList(raw)))
      .catch((e) => console.error("room commands:", e));
  }, [refreshList]);

  const mentionCandidates = useMemo(() => {
    return (room?.members ?? []).filter((m) => m.is_local_agent);
  }, [room]);

  const atMentionCandidates = useMemo((): AtMentionCandidate[] => {
    return (room?.members ?? []).map((m) => {
      const label = weakLabel(m.public_id, m.display_name);
      return {
        key: m.public_id,
        label,
        insertText: `@${label} `,
        description: m.is_local_agent ? "Anima" : "成员",
      };
    });
  }, [room]);

  const resolveMentions = useCallback(
    async (text: string): Promise<string[]> => {
      const fromAnima = await publicIdsFromEntityIds(extractAnimaEntityIds(text));
      const fromName = mentionCandidates
        .filter((m) => text.includes(`@${m.display_name}`) || text.includes(`@${m.public_id}`))
        .map((m) => m.public_id);
      return [...new Set([...fromAnima, ...fromName])].filter((pid) =>
        mentionCandidates.some((m) => m.public_id === pid),
      );
    },
    [mentionCandidates],
  );

  async function handleCreate() {
    if (!userPublicId) {
      setError("无法解析本机用户 public_id");
      return;
    }
    if (createMemberIds.length === 0) {
      setError("请至少选择一名成员");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const picked = await publicIdsFromEntityIds(createMemberIds);
      if (picked.length === 0) {
        setError("所选成员没有有效 public_id");
        return;
      }
      const member_public_ids = [...new Set([userPublicId, ...picked])];
      const created = await api.roomCreate({
        title: createTitle.trim() || "新群聊",
        owner_public_id: userPublicId,
        member_public_ids,
      });
      setCreateOpen(false);
      setCreateTitle("新群聊");
      setCreateMemberIds([]);
      await refreshList();
      await loadRoom(created.room_id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMembers() {
    if (!room || !userPublicId || addMemberIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const picked = await publicIdsFromEntityIds(addMemberIds);
      const existing = new Set(room.members.map((m) => m.public_id));
      const member_public_ids = picked.filter((pid) => !existing.has(pid));
      if (member_public_ids.length === 0) {
        setError("没有可新增的成员（可能已在群内）");
        return;
      }
      await api.roomMembersAdd({
        room_id: room.room_id,
        actor_public_id: userPublicId,
        member_public_ids,
      });
      setAddOpen(false);
      setAddMemberIds([]);
      await loadRoom(room.room_id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const handleSend = useCallback(
    async (payload: ChatComposeSendPayload) => {
      if (!room || !userPublicId) return;
      const text = payload.text.trim();
      if (!text || busy || streamDraft) return;
      if (payload.drafts.length > 0) {
        setError("群聊暂不支持附件");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        if (text.startsWith("/")) {
          const agent = mentionCandidates[0];
          if (!agent) {
            setError("群内没有本机 Anima，无法执行 slash 命令");
            return;
          }
          const seat = await api.roomAgentConversation({
            room_id: room.room_id,
            agent_public_id: agent.public_id,
          });
          if (!seat.ok || !seat.conversation_id) {
            setError(seat.reason ?? "无法绑定 Anima 内心会话");
            return;
          }
          const cmdName = text.slice(1).split(/\s+/).filter(Boolean)[0] ?? "";
          setSlashResult({ command: cmdName, text: "", loading: true });
          try {
            const result = await runConversationCommand(seat.conversation_id, text);
            if (result.delivery === "message") {
              setSlashResult(null);
              // 续流型命令：公开发送并 @ 该 Anima，走群聊触发链路
              const sent = await api.roomMessageSend({
                room_id: room.room_id,
                speaker_public_id: userPublicId,
                text,
                mention_public_ids: [agent.public_id],
              });
              await loadRoom(room.room_id);
              for (const turn of sent.triggered_agent_turns ?? []) {
                await followAgentStream(room.room_id, turn);
              }
              return;
            }
            if (result.delivery === "rpc") {
              if (result.ux === "panel") {
                setSlashResult({ command: result.command, text: result.text });
              } else if (result.ux === "toast") {
                setSlashResult(null);
                toast(result.text, { duration: 4000 });
              } else {
                setSlashResult(null);
              }
              return;
            }
            setSlashResult(null);
            toast("Unexpected slash command response", { duration: 5000 });
            return;
          } catch (e) {
            setSlashResult(null);
            throw e;
          }
        }

        const mention_public_ids = await resolveMentions(text);
        const sent = await api.roomMessageSend({
          room_id: room.room_id,
          speaker_public_id: userPublicId,
          text,
          ...(mention_public_ids.length > 0 ? { mention_public_ids } : {}),
        });
        await loadRoom(room.room_id);
        for (const turn of sent.triggered_agent_turns ?? []) {
          await followAgentStream(room.room_id, turn);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      followAgentStream,
      loadRoom,
      mentionCandidates,
      resolveMentions,
      room,
      streamDraft,
      userPublicId,
    ],
  );

  async function handleAsk(agentId: string) {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.roomAgentTurn({
        room_id: room.room_id,
        agent_public_id: agentId,
      });
      if (!result.ok || !result.stream_id) {
        setError(result.reason ?? "agent.turn failed");
        return;
      }
      setInfoOpen(false);
      await followAgentStream(room.room_id, {
        agent_public_id: agentId,
        stream_id: result.stream_id,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleInterrupt() {
    if (!room || !userPublicId) return;
    await api.roomSpeakerInterrupt({
      room_id: room.room_id,
      actor_public_id: userPublicId,
    });
    await loadRoom(room.room_id);
  }

  async function handleKick(memberPublicId: string) {
    if (!room || !userPublicId) return;
    setBusy(true);
    try {
      await api.roomMembersKick({
        room_id: room.room_id,
        actor_public_id: userPublicId,
        member_public_id: memberPublicId,
      });
      await loadRoom(room.room_id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisband() {
    if (!room || !userPublicId) return;
    setBusy(true);
    try {
      await api.roomDisband({ room_id: room.room_id, actor_public_id: userPublicId });
      setInfoOpen(false);
      setRoom(null);
      setActiveId(null);
      setMessages([]);
      await refreshList();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const headerTitle = room?.title ?? "群聊";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="border bg-muted flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={drawerNav ? "" : "hidden"}
          aria-label="打开群聊列表"
          aria-expanded={listOpen}
          onClick={() => setListOpen((v) => !v)}
        >
          ☰
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{headerTitle}</h1>
          {room ? (
            <p className="text-muted-foreground truncate text-[11px]">
              {room.members.length} 人
              {room.speaker_public_id
                ? ` · 发言中 ${weakLabel(room.speaker_public_id)}`
                : " · 发言席空闲"}
            </p>
          ) : null}
        </div>
        {drawerNav ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 px-2"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            <span className="sr-only">新建群聊</span>
          </Button>
        ) : null}
        {room ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="群聊信息"
            onClick={() => setInfoOpen(true)}
          >
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      {error ? (
        <div className="shrink-0 px-3 pt-2">
          <StatusAlert variant="error">{error}</StatusAlert>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ListDetailLayout
          detailTitle={headerTitle}
          detailHeaderPlacement="none"
          showDetailHeader={false}
          showListHeader={false}
          columnSplitKey="rooms"
          defaultListWidthPx={256}
          listAsideClassName="border bg-background"
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          list={() => (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 space-y-2 p-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 inline size-4" aria-hidden />
                  新建群聊
                </Button>
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-1">
                {rooms.length === 0 ? (
                  <li className="text-muted-foreground px-1 py-4 text-sm">
                    还没有群聊，点「新建」选人开房
                  </li>
                ) : (
                  rooms.map((r) => (
                    <li key={r.room_id}>
                      <button
                        type="button"
                        className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                          activeId === r.room_id ? "bg-accent" : "hover:bg-muted"
                        }`}
                        onClick={() => void loadRoom(r.room_id)}
                      >
                        <span className="block truncate font-medium">{r.title}</span>
                        <span className="text-muted-foreground text-[11px]">
                          {r.members.length} 人
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        >
          {!room ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-sm">
              <p>选择或新建一个群聊</p>
              {drawerNav ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 inline size-4" aria-hidden />
                  新建群聊
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <RoomTranscript
                messages={messages}
                selfPublicId={userPublicId}
                streamDraft={streamDraft}
              />

              {slashResult ? (
                <div className="shrink-0 px-3 pt-2">
                  <SlashCommandResultPanel
                    command={slashResult.command}
                    text={slashResult.text}
                    {...(slashResult.loading ? { loading: true } : {})}
                    onClose={() => setSlashResult(null)}
                    renderMd={(t) => renderMarkdownHtml(t)}
                  />
                </div>
              ) : null}

              <div className="border-t border bg-background relative chat-compose px-2 py-2">
                <ChatComposeForm
                  conversationId={room.room_id ? `room:${room.room_id}` : null}
                  commandList={commandList}
                  menuInFlow={compact}
                  streamVisible={!!streamDraft}
                  canSendOnline={!busy}
                  atMentionCandidates={atMentionCandidates}
                  onSend={handleSend}
                  onStopStreaming={() => void handleInterrupt()}
                />
                <p className="text-muted-foreground mt-1 px-1 text-[11px]">
                  输入 <code className="text-[10px]">/</code> 命令，或{" "}
                  <code className="text-[10px]">@</code> 提及成员
                </p>
              </div>
            </div>
          )}
        </ListDetailLayout>
      </div>

      {room ? (
        <RoomInfoSheet
          open={infoOpen}
          onOpenChange={setInfoOpen}
          room={room}
          userPublicId={userPublicId}
          busy={busy}
          streamBusy={!!streamDraft}
          onAddMembers={() => {
            setAddMemberIds([]);
            setInfoOpen(false);
            setAddOpen(true);
          }}
          onAsk={(id) => void handleAsk(id)}
          onKick={(id) => void handleKick(id)}
          onInterrupt={() => void handleInterrupt()}
          onDisband={() => void handleDisband()}
        />
      ) : null}

      <ModalSheetPresent
        open={createOpen}
        onClose={() => {
          if (!busy) setCreateOpen(false);
        }}
        aria-label="新建群聊"
        showCloseButton
        className="p-4"
      >
        <div className="space-y-4">
          <h2 className="text-base font-medium">新建群聊</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="room-create-title">
              标题
            </label>
            <Input
              id="room-create-title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="群聊名称"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">选择成员</p>
            <RoomMemberChecklist
              active={createOpen}
              value={createMemberIds}
              onChange={setCreateMemberIds}
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">你本人会自动加入；请至少再选一人。</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              isDisabled={busy}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              isDisabled={busy || createMemberIds.length === 0}
            >
              创建
            </Button>
          </div>
        </div>
      </ModalSheetPresent>

      <ModalSheetPresent
        open={addOpen}
        onClose={() => {
          if (!busy) setAddOpen(false);
        }}
        aria-label="添加成员"
        showCloseButton
        className="p-4"
      >
        <div className="space-y-4">
          <h2 className="text-base font-medium">添加成员</h2>
          <RoomMemberChecklist
            active={addOpen}
            value={addMemberIds}
            onChange={setAddMemberIds}
            alreadyInPublicIds={room?.members.map((m) => m.public_id) ?? []}
            disabled={busy}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              isDisabled={busy}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleAddMembers()}
              isDisabled={busy || addMemberIds.length === 0}
            >
              加入
            </Button>
          </div>
        </div>
      </ModalSheetPresent>
    </div>
  );
}
