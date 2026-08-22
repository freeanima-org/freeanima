import { UserPlus, Users } from "lucide-react";
import { Button, Sheet, SheetHeader, SheetTitle } from "@freeanima/ui-kit";
import type { RoomSummaryPayload } from "@freeanima/shared/rpc-contract/frames/room.ts";

function weakLabel(publicId: string, display?: string): string {
  if (display?.trim()) return display.trim();
  if (publicId.length <= 10) return publicId;
  return `${publicId.slice(0, 6)}…`;
}

function initialGlyph(label: string): string {
  const t = label.trim();
  if (!t) return "?";
  return t.slice(0, 1);
}

export type RoomInfoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomSummaryPayload;
  userPublicId: string | null;
  busy: boolean;
  streamBusy: boolean;
  onAddMembers: () => void;
  onAsk: (agentPublicId: string) => void;
  onKick: (memberPublicId: string) => void;
  onInterrupt: () => void;
  onDisband: () => void;
};

/** 微信式群信息：右侧抽屉，成员网格 + 管理操作。 */
export function RoomInfoSheet({
  open,
  onOpenChange,
  room,
  userPublicId,
  busy,
  streamBusy,
  onAddMembers,
  onAsk,
  onKick,
  onInterrupt,
  onDisband,
}: RoomInfoSheetProps) {
  const isOwner = userPublicId != null && userPublicId === room.owner_public_id;

  return (
    <Sheet
      isOpen={open}
      onOpenChange={onOpenChange}
      side="right"
      className="w-full gap-0 p-0 data-[side=right]:w-[min(100%,20rem)] data-[side=right]:sm:max-w-sm"
    >
      <SheetHeader className="border-b shrink-0 px-4 py-3 pr-12">
        <SheetTitle>群聊信息</SheetTitle>
        <p className="text-muted-foreground truncate text-xs">{room.title}</p>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <section className="border-b px-3 py-3">
          <div className="text-muted-foreground mb-2 flex items-center gap-1.5 px-1 text-xs font-medium">
            <Users className="size-3.5" aria-hidden />
            群成员（{room.members.length}）
          </div>
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {room.members.map((m) => {
              const label = weakLabel(m.public_id, m.display_name);
              const isSelf = userPublicId != null && m.public_id === userPublicId;
              return (
                <li key={m.public_id} className="flex min-w-0 flex-col items-center gap-1">
                  <div
                    className="bg-muted text-foreground flex size-12 items-center justify-center rounded-md text-base font-medium"
                    title={label}
                  >
                    {initialGlyph(label)}
                  </div>
                  <span className="w-full truncate text-center text-[11px] leading-tight">
                    {label}
                    {m.public_id === room.owner_public_id ? " · 主" : ""}
                    {isSelf ? " · 我" : ""}
                  </span>
                  {m.is_local_agent ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1 text-[11px]"
                      onClick={() => onAsk(m.public_id)}
                      isDisabled={busy || streamBusy}
                    >
                      请发言
                    </Button>
                  ) : null}
                  {isOwner && m.public_id !== room.owner_public_id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-7 px-1 text-[11px]"
                      onClick={() => onKick(m.public_id)}
                      isDisabled={busy}
                    >
                      移出
                    </Button>
                  ) : null}
                </li>
              );
            })}
            <li className="flex min-w-0 flex-col items-center gap-1">
              <Button
                type="button"
                variant="outline"
                className="size-12 rounded-md p-0"
                aria-label="添加成员"
                onClick={onAddMembers}
                isDisabled={busy || !isOwner}
              >
                <UserPlus className="size-5" aria-hidden />
              </Button>
              <span className="text-muted-foreground w-full truncate text-center text-[11px]">
                添加
              </span>
            </li>
          </ul>
          {!isOwner ? (
            <p className="text-muted-foreground mt-2 px-1 text-[11px]">仅群主可添加或移出成员</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2 p-3">
          <div className="text-muted-foreground px-1 text-xs">
            发言席：
            {room.speaker_public_id ? weakLabel(room.speaker_public_id) : "空闲"}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={onInterrupt}
            isDisabled={busy}
          >
            打断当前发言
          </Button>
          {isOwner ? (
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-start"
              onClick={onDisband}
              isDisabled={busy}
            >
              解散群聊
            </Button>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
