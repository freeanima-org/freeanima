import { Link } from "@tanstack/react-router";
import { Badge, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { m } from "@admin/lib/i18n.ts";

export type FridgeMagnetItem = {
  key: string;
  value: string;
  module: "conversation" | "other";
  conversation_id?: string;
  label?: string;
  ttl_seconds: number | null;
};

export function formatFridgeTtl(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 0) return m.admin_fridge_expiry_none();
  if (seconds < 60) return m.admin_fridge_expiry_seconds({ seconds: String(seconds) });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0)
    return m.admin_fridge_expiry_hours({ hours: String(hours), minutes: String(minutes) });
  return m.admin_fridge_expiry_minutes({ minutes: String(minutes) });
}

type FridgeMagnetDetailListProps = {
  magnets: FridgeMagnetItem[];
  redisConfigured: boolean;
};

export function FridgeMagnetDetailList({ magnets, redisConfigured }: FridgeMagnetDetailListProps) {
  if (!redisConfigured) {
    return <StatusAlert variant="warning">{m.admin_fridge_redis_down()}</StatusAlert>;
  }

  if (magnets.length === 0) {
    return <StatusAlert variant="info">{m.admin_fridge_empty()}</StatusAlert>;
  }

  return (
    <div className="space-y-3">
      {magnets.map((magnet) => (
        <Card key={magnet.key} className="bg-muted py-0">
          <CardContent className="gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="ghost" className="text-xs font-mono">
                {magnet.key}
              </Badge>
              {magnet.module === "conversation" ? (
                <Badge className="text-xs">{m.admin_fridge_badge_conversation()}</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {formatFridgeTtl(magnet.ttl_seconds)}
              </span>
            </div>
            {magnet.conversation_id ? (
              <div className="text-xs">
                {m.admin_common_conversation_label()}{" "}
                <Link
                  to="/conversations/$conversationId"
                  params={{ conversationId: magnet.conversation_id }}
                  className="text-primary underline-offset-4 hover:underline text-xs font-mono"
                >
                  {magnet.conversation_id}
                </Link>
              </div>
            ) : null}
            <p className="text-sm whitespace-pre-wrap">{magnet.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
