import { useMemo, useState, useEffect, type ReactNode } from "react";
import { Button } from "@freeanima/frontend/ui-kit";
import type {
  SettingsBinding,
  SettingsCategory,
  SettingsPlatform,
} from "@freeanima/frontend/shell-sdk/settings";
import { listSettingsSectionsForPlatform } from "@freeanima/frontend/shell-sdk/settings";

import { needsHubSetup } from "../setup/hub-setup.ts";
import { SettingsSectionPanel } from "./SettingsSectionPanel.tsx";

type Props = {
  bindings: SettingsBinding[];
  chromePlatform: SettingsPlatform;
  contentPlatform: SettingsPlatform;
};

const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  client: "本机",
  server: "Hub 服务",
};

const CATEGORY_ORDER: SettingsCategory[] = ["client", "server"];

function sectionCategory(binding: SettingsBinding): SettingsCategory {
  return binding.section.category ?? "client";
}

function groupBindings(bindings: SettingsBinding[]): Array<{
  category: SettingsCategory;
  label: string;
  items: SettingsBinding[];
}> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: bindings.filter((b) => sectionCategory(b) === category),
  })).filter((g) => g.items.length > 0);
}

function resolveInitialSectionId(bindings: SettingsBinding[], platform: SettingsPlatform): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("section")?.trim();
  const visible = listSettingsSectionsForPlatform(bindings, platform);
  const normalizedQuery = fromQuery === "hub-runtime" ? "compression" : fromQuery;
  if (normalizedQuery && visible.some((b) => b.section.id === normalizedQuery)) {
    return normalizedQuery;
  }
  if (needsHubSetup() && visible.some((b) => b.section.id === "hub")) {
    return "hub";
  }
  return visible[0]?.section.id ?? "";
}

function SectionContent({
  binding,
  contentPlatform,
}: {
  binding: SettingsBinding;
  contentPlatform: SettingsPlatform;
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
      <SettingsSectionPanel binding={binding} platform={contentPlatform} />
    </section>
  );
}

function renderNavButton(
  binding: SettingsBinding,
  activeId: string,
  onSelect: (id: string) => void,
  chrome: "sidebar" | "tabs",
  className?: string,
): ReactNode {
  const isActive = activeId === binding.section.id;
  const variant =
    chrome === "tabs" ? (isActive ? "default" : "ghost") : isActive ? "secondary" : "ghost";
  return (
    <Button
      key={binding.section.id}
      type="button"
      size="sm"
      variant={variant}
      className={className}
      onClick={() => onSelect(binding.section.id)}
    >
      {binding.section.title}
    </Button>
  );
}

export function SettingsHost({ bindings, chromePlatform, contentPlatform }: Props) {
  const visible = useMemo(
    () => listSettingsSectionsForPlatform(bindings, contentPlatform),
    [bindings, contentPlatform],
  );
  const groups = useMemo(() => groupBindings(visible), [visible]);
  const [activeId, setActiveId] = useState<string>(() =>
    resolveInitialSectionId(bindings, contentPlatform),
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
    <nav className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border bg-muted/40 items-center">
      {groups.map((group, groupIndex) => (
        <div key={group.category} className="contents">
          {groupIndex > 0 ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 shrink-0">
              |
            </span>
          ) : null}
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 shrink-0">
            {group.label}
          </span>
          {group.items.map((binding) =>
            renderNavButton(binding, active?.section.id ?? "", setActiveId, "tabs", "shrink-0"),
          )}
        </div>
      ))}
    </nav>
  );

  const sectionSidebar = (
    <nav className="w-52 h-full shrink-0 border-r border bg-muted/40 p-3 overflow-y-auto">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.category}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2 mb-1">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((binding) => (
                <li key={binding.section.id}>
                  {renderNavButton(
                    binding,
                    active?.section.id ?? "",
                    setActiveId,
                    "sidebar",
                    "w-full justify-start",
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  const sectionBody = (
    <div
      className={`flex-1 min-w-0 overflow-y-auto px-4 py-4 lg:p-5 ${
        chromePlatform === "mobile" ? "pb-4" : ""
      }`}
    >
      {active ? <SectionContent binding={active} contentPlatform={contentPlatform} /> : null}
    </div>
  );

  const showSidebar = chromePlatform !== "mobile";

  return (
    <div className={`flex h-full min-h-0 ${showSidebar ? "flex-row" : "flex-col"}`}>
      {!showSidebar ? <div className="shrink-0">{sectionTabs}</div> : null}
      {showSidebar ? (
        <div className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden">
          {sectionSidebar}
        </div>
      ) : null}
      {sectionBody}
    </div>
  );
}
