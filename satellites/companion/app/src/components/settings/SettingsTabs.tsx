import { useCompanionStore } from "@/stores/companion.ts";

export function SettingsTabs() {
  const tab = useCompanionStore((s) => s.settingsTab);
  const setTab = useCompanionStore((s) => s.setSettingsTab);

  const tabs = [
    { id: "general" as const, label: "通用" },
    { id: "behavior" as const, label: "行为" },
    { id: "models" as const, label: "模型" },
    { id: "slots" as const, label: "动作槽位" },
    { id: "library" as const, label: "动作库" },
  ];

  return (
    <div className="flex flex-wrap gap-1 mb-3 border-b border-white/10 pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`rounded-md px-2 py-1 text-xs ${
            tab === t.id ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/5"
          }`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
