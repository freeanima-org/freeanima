import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  getTypedHabitatClient,
  type HabitatMethodOutputs,
} from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

type SatelliteItem = HabitatMethodOutputs["federation.satellite.list"]["items"][number];

function statusLabel(item: SatelliteItem): string {
  if (item.status === "pending") {
    return item.online ? "待授信 · 在线" : "待授信 · 离线";
  }
  if (item.status === "trusted") {
    return item.online ? "已授信 · 在线" : "已授信 · 离线";
  }
  return "已拒绝";
}

/** Hub：Satellite 连接触发 pending；人工批准 / 拒绝（仅 user UI）。 */
export function HubTrustedSatellitesPanel() {
  const [items, setItems] = useState<SatelliteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveLabels, setApproveLabels] = useState<Record<string, string>>({});
  const [approveContact, setApproveContact] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const out = await getTypedHabitatClient().call("federation.satellite.list", {});
      setItems(out.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const pending = items.filter((item) => item.status === "pending");
  const trusted = items.filter((item) => item.status === "trusted");

  async function handleApprove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const label = approveLabels[id]?.trim();
      await getTypedHabitatClient().call("federation.satellite.approve", {
        satellite_habitat_instance_id: id,
        ...(label ? { label } : {}),
        ...(approveContact[id] ? { create_contact: true } : {}),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(id: string) {
    setBusy(true);
    setError(null);
    try {
      await getTypedHabitatClient().call("federation.satellite.reject", {
        satellite_habitat_instance_id: id,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await getTypedHabitatClient().call("federation.satellite.revoke", {
        satellite_habitat_instance_id: id,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">授信 Satellite</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          isDisabled={busy}
        >
          刷新
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Satellite 配置 Hub 并出站连接后，会出现在「待授信」列表；批准或拒绝须人工操作（Agent / MCP
        不可代劳）。
      </p>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      <div className="space-y-2">
        <p className="text-xs font-medium">待授信（{pending.length}）</p>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无连接请求</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => (
              <li
                key={item.satellite_habitat_instance_id}
                className="space-y-2 rounded border border-amber-500/40 bg-amber-500/5 px-2 py-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-mono text-xs">{item.satellite_habitat_instance_id}</p>
                  <p className="text-muted-foreground text-[11px]">{statusLabel(item)}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fed-label-${item.satellite_habitat_instance_id}`}>
                    备注（可选）
                  </Label>
                  <Input
                    id={`fed-label-${item.satellite_habitat_instance_id}`}
                    value={approveLabels[item.satellite_habitat_instance_id] ?? ""}
                    onChange={(e) =>
                      setApproveLabels((prev) => ({
                        ...prev,
                        [item.satellite_habitat_instance_id]: e.target.value,
                      }))
                    }
                    placeholder="如：家里 NAS"
                    disabled={busy}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={approveContact[item.satellite_habitat_instance_id] ?? false}
                    onChange={(e) =>
                      setApproveContact((prev) => ({
                        ...prev,
                        [item.satellite_habitat_instance_id]: e.target.checked,
                      }))
                    }
                    disabled={busy}
                  />
                  批准后同时加入通讯录
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleApprove(item.satellite_habitat_instance_id)}
                    isDisabled={busy}
                  >
                    批准
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => void handleReject(item.satellite_habitat_instance_id)}
                    isDisabled={busy}
                  >
                    拒绝
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium">已授信（{trusted.length}）</p>
        {trusted.length === 0 ? (
          <p className="text-muted-foreground text-xs">尚无已授信 Satellite</p>
        ) : (
          <ul className="space-y-2">
            {trusted.map((item) => (
              <li
                key={item.satellite_habitat_instance_id}
                className="flex items-start justify-between gap-2 rounded border border-border/60 px-2 py-1.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs font-medium">
                    {item.label?.trim() || item.satellite_habitat_instance_id}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {item.satellite_habitat_instance_id}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {statusLabel(item)}
                    {item.linked_contact_id != null ? ` · 通讯录 #${item.linked_contact_id}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  isDisabled={busy}
                  onClick={() => void handleRevoke(item.satellite_habitat_instance_id)}
                >
                  撤销
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
