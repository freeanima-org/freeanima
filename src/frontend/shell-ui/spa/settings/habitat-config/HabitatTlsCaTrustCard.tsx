import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { fetchTlsCaInfo, type TlsCaInfo } from "@freeanima/frontend/shell-sdk/tls-ca-api";

type Props = {
  habitatUrl?: string;
};

export function HabitatTlsCaTrustCard({ habitatUrl }: Props) {
  const [info, setInfo] = useState<TlsCaInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchTlsCaInfo(habitatUrl);
        if (!cancelled) setInfo(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habitatUrl]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">检查 TLS 根证书…</p>;
  }

  if (error) {
    return null;
  }

  if (!info) return null;

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">局域网 HTTPS 信任</h3>
          <p className="text-xs text-muted-foreground">
            桌面壳 / 手机访问 <code className="text-xs">https://…:2659</code>{" "}
            时若「测试连接」失败或控制台报证书错误，须先将 Habitat 的 mkcert 根 CA
            装入本机系统信任库。请用 <strong>HTTP 端口</strong> 下载（下方链接已自动使用{" "}
            <code className="text-xs">:2658</code>）。
          </p>
        </div>

        {info.available ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-md border bg-background p-2">
              <img
                src={info.qr_data_url ?? info.qr_url}
                width={200}
                height={200}
                alt="下载根 CA 的二维码"
                className="block size-[200px]"
              />
              <p className="mt-2 max-w-[200px] text-center text-[10px] text-muted-foreground">
                手机扫码下载 rootCA.pem
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {info.issuer ? (
                <p className="text-xs text-muted-foreground">签发者：{info.issuer}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{info.install_hint}</p>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={info.download_url} download={info.filename}>
                  下载 {info.filename}
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <StatusAlert variant="warning">{info.install_hint}</StatusAlert>
        )}
      </CardContent>
    </Card>
  );
}
