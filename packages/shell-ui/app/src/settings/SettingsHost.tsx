import { useMemo, useState, useEffect } from "react";
import { Button } from "@freeanima/ui-kit";
import type { SettingsBinding, SettingsPlatform } from "@freeanima/shell-sdk/settings";
import { listSettingsSectionsForPlatform } from "@freeanima/shell-sdk/settings";

import { SettingsSectionPanel } from "./SettingsSectionPanel.tsx";

type Props = {
  bindings: SettingsBinding[];
  platform: SettingsPlatform;
};

function resolveInitialSectionId(bindings: SettingsBinding[], platform: SettingsPlatform): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("section")?.trim();
  const visible = listSettingsSectionsForPlatform(bindings, platform);
  if (fromQuery && visible.some((b) => b.section.id === fromQuery)) return fromQuery;
  return visible[0]?.section.id ?? "";
}

function SectionContent({
  binding,
  platform,
}: {
  binding: SettingsBinding;
  platform: SettingsPlatform;
}) {
  const { section } = binding;
  return (
    <section>
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{section.title}</h2>
        {section.description ? (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
            {section.description}
          </p>
        ) : null}
      </header>
      <SettingsSectionPanel binding={binding} platform={platform} />
    </section>
  );
}

export function SettingsHost({ bindings, platform }: Props) {
  const visible = useMemo(
    () => listSettingsSectionsForPlatform(bindings, platform),
    [bindings, platform],
  );
  const [activeId, setActiveId] = useState<string>(() =>
    resolveInitialSectionId(bindings, platform),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === activeId) return;
    params.set("section", activeId);
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [activeId]);

  const active = visible.find((b) => b.section.id === activeId) ?? visible[0];

  if (visible.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">暂无可用设置</p>;
  }

  const sectionTabs = (
    <nav className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border bg-muted/40">
      {visible.map((binding) => (
        <Button
          key={binding.section.id}
          type="button"
          size="sm"
          variant={active?.section.id === binding.section.id ? "default" : "ghost"}
          className="shrink-0"
          onClick={() => setActiveId(binding.section.id)}
        >
          {binding.section.title}
        </Button>
      ))}
    </nav>
  );

  const sectionSidebar = (
    <nav className="w-52 shrink-0 border-r border bg-muted/40 p-3 overflow-y-auto">
      <ul className="flex flex-col gap-0.5">
        {visible.map((binding) => (
          <li key={binding.section.id}>
            <Button
              type="button"
              size="sm"
              variant={active?.section.id === binding.section.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveId(binding.section.id)}
            >
              {binding.section.title}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );

  const sectionBody = (
    <div
      className={`flex-1 min-w-0 overflow-y-auto px-4 py-4 lg:p-5 ${
        platform === "mobile" ? "pb-4" : ""
      }`}
    >
      {active ? <SectionContent binding={active} platform={platform} /> : null}
    </div>
  );

  const showSidebar = platform !== "mobile";

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className={showSidebar ? "lg:hidden shrink-0" : "shrink-0"}>{sectionTabs}</div>
      {showSidebar ? (
        <div className="hidden lg:block shrink-0 min-h-0">{sectionSidebar}</div>
      ) : null}
      {sectionBody}
    </div>
  );
}
