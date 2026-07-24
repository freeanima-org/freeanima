import { Tabs, TabsList, TabsTrigger } from "@freeanima/ui-kit";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";

const TAB_IDS = ["behavior", "models", "library", "slots"] as const;

export function SettingsTabs() {
  const tab = useCompanionStore((s) => s.settingsTab);
  const setTab = useCompanionStore((s) => s.setSettingsTab);

  const tabs = [
    { id: "behavior" as const, label: "行为" },
    { id: "models" as const, label: "模型" },
    { id: "library" as const, label: "动作库" },
    { id: "slots" as const, label: "动作槽位" },
  ];

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if ((TAB_IDS as readonly string[]).includes(value)) {
          setTab(value as (typeof TAB_IDS)[number]);
        }
      }}
      className="mx-5 mt-2 mb-0 shrink-0 gap-0"
    >
      <TabsList className="h-auto w-full flex-wrap gap-1 bg-muted/40 p-1" aria-label="设置分类">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
