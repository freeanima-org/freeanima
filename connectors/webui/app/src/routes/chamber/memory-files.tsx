import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc.ts";

export const Route = createFileRoute("/chamber/memory-files")({
  loader: () => trpc.memory.files.query().catch(() => null),
  component: MemoryFilesPage,
});

function MemoryFilesPage() {
  const mem = Route.useLoaderData() as { files?: Array<{ name: string; size: number }> } | null;

  if (mem === null) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">记忆文件</h2>
        <div className="alert alert-error text-sm">加载记忆文件失败</div>
      </div>
    );
  }

  const memoryFiles = mem.files ?? [];

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">记忆文件</h2>
      <div className="card bg-base-200">
        <div className="card-body">
          {memoryFiles.length === 0 ? (
            <div className="text-sm text-base-content/50">无记忆文件</div>
          ) : (
            <div className="space-y-2">
              {memoryFiles.map((f) => (
                <div key={f.name} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{f.name}</span>
                  <span className="text-xs text-base-content/50">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
