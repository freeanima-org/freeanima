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
        <h1 className="text-lg font-semibold">FreeAnima Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          直连 Habitat（Service API Token）。主密码仅在扩展内存中用于解密用户库，不会发送到
          Habitat。请用 <code className="text-xs">anima token create</code> 创建 Token。
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
    </div>
  );
}
