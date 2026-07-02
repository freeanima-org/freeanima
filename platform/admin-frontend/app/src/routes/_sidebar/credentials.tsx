import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@freeanima/ui-kit";
import { m } from "@admin/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar/credentials")({
  component: CredentialsRedirectPage,
});

function CredentialsRedirectPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{m.admin_nav_credentials()}</h1>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p>
            pass 凭据已下线。请在 Shell <strong>保险库</strong>（<code>/web/vault</code>
            ）管理 User / Agent 库条目；运行时 config 使用{" "}
            <code>vault(&quot;item_id&quot;, &quot;field&quot;)</code> 或 <code>env()</code>。
          </p>
          <p className="text-sm opacity-70">
            旧 <code>~/.password-store</code> 目录不会被删除，可手动迁移后保留只读备份。
          </p>
          <Link to="/dashboard" className="link link-primary">
            返回管理台
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
