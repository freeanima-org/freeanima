import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/lib/i18n.ts";

function ComingSoonView({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-base-content/60 mt-2">{description}</p>
      <div className="badge badge-outline mt-6">{m.webui_common_coming_soon()}</div>
    </div>
  );
}

export const Route = createFileRoute("/studio/novel")({
  component: () => (
    <ComingSoonView title={m.webui_studio_nav_novel()} description={m.webui_studio_novel_desc()} />
  ),
});
