import { useCompanionStore } from "@/stores/companion.ts";

export function SettingsTabs() {
  const tab = useCompanionStore((s) => s.settingsTab);
  const setTab = useCompanionStore((s) => s.setSettingsTab);

  const tabs = [
    { id: "general" as const, label: "通用" },
    { id: "behavior" as const, label: "行为" },
    { id: "models" as const, label: "模型" },
    { id: "library" as const, label: "动作库" },
    { id: "slots" as const, label: "动作槽位" },
  ];

  return (
    <div
      role="tablist"
      className="tabs tabs-boxed bg-base-300/40 mx-5 mt-2 mb-0 shrink-0 flex-wrap h-auto gap-1 p-1"
      aria-label="设置分类"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className={`tab tab-sm ${tab === t.id ? "tab-active" : ""}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
