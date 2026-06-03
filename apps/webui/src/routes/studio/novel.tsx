import { createFileRoute } from "@tanstack/react-router";

function ComingSoonView({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-base-content/60 mt-2">{description}</p>
      <div className="badge badge-outline mt-6">即将推出</div>
    </div>
  );
}

export const Route = createFileRoute("/studio/novel")({
  component: () => (
    <ComingSoonView title="📖 长篇小说创作" description="长篇协同创作工作台尚在规划中。" />
  ),
});
