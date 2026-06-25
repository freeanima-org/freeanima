import { useMemo, useState, useEffect } from "react";
import type { SettingsBinding, SettingsPlatform } from "@freeanima/satellite-sdk/settings";
import { listSettingsSectionsForPlatform } from "@freeanima/satellite-sdk/settings";

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
          <p className="text-sm text-base-content/60 mt-1 whitespace-pre-line">
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
    return <p className="p-6 text-sm text-base-content/60">暂无可用设置</p>;
  }

  if (platform === "mobile") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <nav className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-base-300 bg-base-200/40">
          {visible.map((binding) => (
            <button
              key={binding.section.id}
              type="button"
              className={`btn btn-sm shrink-0 ${active?.section.id === binding.section.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveId(binding.section.id)}
            >
              {binding.section.title}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-4 pb-[env(safe-area-inset-bottom)]">
          {active ? <SectionContent binding={active} platform={platform} /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-52 shrink-0 border-r border-base-300 bg-base-200/40 p-3 overflow-y-auto">
        <ul className="menu menu-sm gap-0.5">
          {visible.map((binding) => (
            <li key={binding.section.id}>
              <button
                type="button"
                className={active?.section.id === binding.section.id ? "active" : ""}
                onClick={() => setActiveId(binding.section.id)}
              >
                {binding.section.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        {active ? <SectionContent binding={active} platform={platform} /> : null}
      </div>
    </div>
  );
}
