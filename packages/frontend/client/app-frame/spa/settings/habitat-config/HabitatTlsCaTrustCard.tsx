import { useEffect, useState } from "react";
import { Button, buttonVariants, cn } from "@freeanima/ui-kit";
import { ModalSheetPresent, StatusAlert } from "@freeanima/ui-kit/composite";
import { fetchTlsCaInfo, type TlsCaInfo } from "@freeanima/client/portal-sdk/tls-ca-api";
import { XIcon } from "lucide-react";

type Props = {
  habitatUrl?: string;
};

export function HabitatTlsCaTrustCard({ habitatUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<TlsCaInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return () => {};
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      setInfo(null);
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
  }, [open, habitatUrl]);

  const title = info?.kind === "letsencrypt" ? "HTTPS 证书（Let's Encrypt）" : "局域网 HTTPS 信任";

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        局域网 TLS 证书
      </Button>
      <ModalSheetPresent
        open={open}
        onClose={() => setOpen(false)}
        aria-label={title}
        className="sm:max-w-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭"
            onClick={() => setOpen(false)}
          >
            <XIcon />
          </Button>
        </div>
        <div className="max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto p-4">
          {loading ? <p className="text-sm text-muted-foreground">检查 TLS 根证书…</p> : null}
          {error ? <StatusAlert variant="warning">{error}</StatusAlert> : null}
          {info ? (
            <>
              <p className="text-xs text-muted-foreground">
                {info.kind === "letsencrypt" ? (
                  <>
                    公网域名证书由 Let's Encrypt 签发，浏览器与桌面壳默认信任，无需安装根
                    CA。请用域名访问 <code className="text-xs">https://…:2659</code>。
                  </>
                ) : (
                  <>
                    桌面壳 / 手机访问 <code className="text-xs">https://…:2659</code>{" "}
                    时若「测试连接」失败或控制台报证书错误，须先将 Habitat 的 mkcert 根 CA
                    装入本机系统信任库。请用 <strong>HTTP 端口</strong> 下载（下方链接已自动使用{" "}
                    <code className="text-xs">:2658</code>）。
                  </>
                )}
              </p>
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
                    <a
                      href={info.download_url}
                      download={info.filename}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      下载 {info.filename}
                    </a>
                  </div>
                </div>
              ) : (
                <StatusAlert variant="warning">{info.install_hint}</StatusAlert>
              )}
            </>
          ) : null}
        </div>
      </ModalSheetPresent>
    </>
  );
}
