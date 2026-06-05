import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio/short-video")({
  component: () => (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold">🎬 短视频创作</h2>
      <p className="text-sm text-base-content/60 mt-2">该协同工作台尚在规划中。</p>
      <div className="badge badge-outline mt-6">即将推出</div>
    </div>
  ),
});
