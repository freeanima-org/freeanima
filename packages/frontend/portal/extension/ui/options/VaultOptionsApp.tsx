import { useEffect, useState } from "react";
import { Button, Input } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { sendBg } from "../../runtime/messages.ts";
import { loadSettings, saveSettings } from "../../runtime/settings.ts";

export function VaultOptionsApp() {
  const [habitatUrl, setHabitatUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadSettings().then((s) => {
      setHabitatUrl(s.habitat_url);
      setAuthToken(s.auth_token);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">FreeAnima</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览器形态入口：直连栖息地（Service API
          Token）。主密码仅在扩展内存中用于解密用户库，不会发送到 Habitat。请用{" "}
          <code className="text-xs">anima token create</code> 创建 Token。
        </p>
      </div>
      <label className="block space-y-1 text-sm">
        <span>Habitat URL</span>
        <Input
          type="url"
          value={habitatUrl}
          placeholder="http://127.0.0.1:2658"
          autoComplete="off"
          onChange={(e) => setHabitatUrl(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>API Token</span>
        <Input
          type="password"
          value={authToken}
          placeholder="fa_at_…"
          autoComplete="off"
          onChange={(e) => setAuthToken(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => {
            void (async () => {
              await saveSettings({ habitat_url: habitatUrl, auth_token: authToken });
              setMsg({ ok: true, text: "已保存" });
            })();
          }}
        >
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void (async () => {
              await saveSettings({ habitat_url: habitatUrl, auth_token: authToken });
              const res = await sendBg({ type: "test_connection" });
              if (res.ok && "message" in res) setMsg({ ok: true, text: res.message });
              else if (!res.ok) setMsg({ ok: false, text: res.error });
            })();
          }}
        >
          测试连接
        </Button>
      </div>
      {msg ? <StatusAlert variant={msg.ok ? "success" : "error"}>{msg.text}</StatusAlert> : null}

      <BookmarkSyncSection />
    </div>
  );
}

function BookmarkSyncSection() {
  const [enabled, setEnabled] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void sendBg({ type: "bookmark_get_sync_settings" }).then((res) => {
      if (res.ok && "bookmark_sync" in res) {
        setEnabled(res.bookmark_sync.enabled);
        setLastSyncAt(res.bookmark_sync.last_sync_at);
        setLastError(res.bookmark_sync.last_error);
      }
    });
  }, []);

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h2 className="text-base font-semibold">书签同步</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          开启后，浏览器书签树与栖息地 entity 双向同步（冲突按更新时间后写优先）。
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            setBusy(true);
            void (async () => {
              const res = await sendBg({ type: "bookmark_set_sync_enabled", enabled: next });
              setBusy(false);
              if (res.ok && "message" in res) {
                setEnabled(next);
                setMsg({ ok: true, text: res.message });
                const st = await sendBg({ type: "bookmark_get_sync_settings" });
                if (st.ok && "bookmark_sync" in st) {
                  setLastSyncAt(st.bookmark_sync.last_sync_at);
                  setLastError(st.bookmark_sync.last_error);
                }
              } else if (!res.ok) {
                setMsg({ ok: false, text: res.error });
              }
            })();
          }}
        />
        <span>启用自动同步</span>
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !enabled}
          onClick={() => {
            setBusy(true);
            void (async () => {
              const res = await sendBg({ type: "bookmark_sync_now", full: true });
              setBusy(false);
              if (res.ok && "message" in res) setMsg({ ok: true, text: res.message });
              else if (!res.ok) setMsg({ ok: false, text: res.error });
              const st = await sendBg({ type: "bookmark_get_sync_settings" });
              if (st.ok && "bookmark_sync" in st) {
                setLastSyncAt(st.bookmark_sync.last_sync_at);
                setLastError(st.bookmark_sync.last_error);
              }
            })();
          }}
        >
          立即同步
        </Button>
      </div>
      {lastSyncAt ? <p className="text-xs text-muted-foreground">上次同步：{lastSyncAt}</p> : null}
      {lastError ? <StatusAlert variant="error">{lastError}</StatusAlert> : null}
      {msg ? <StatusAlert variant={msg.ok ? "success" : "error"}>{msg.text}</StatusAlert> : null}
    </div>
  );
}
