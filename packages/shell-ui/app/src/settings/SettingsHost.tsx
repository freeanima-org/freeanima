import { useMemo, useState } from "react";
import type { SettingsSection, SettingsPlatform } from "../../../src/settings.ts";
import { listSettingsSectionsForPlatform } from "../../../src/settings.ts";

import { SettingsSectionPanel } from "./SettingsSectionPanel.tsx";

type Props = {
  sections: SettingsSection[];
  platform: SettingsPlatform;
};

export function SettingsHost({ sections, platform }: Props) {
  const visible = useMemo(
    () => listSettingsSectionsForPlatform(sections, platform),
    [sections, platform],
  );
  const [activeId, setActiveId] = useState<string>(() => visible[0]?.id ?? "");

  const active = visible.find((s) => s.id === activeId) ?? visible[0];

  if (visible.length === 0) {
    return <p className="p-6 text-sm text-base-content/60">暂无可用设置</p>;
  }

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-52 shrink-0 border-r border-base-300 bg-base-200/40 p-3 overflow-y-auto">
        <ul className="menu menu-sm gap-0.5">
          {visible.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={active?.id === section.id ? "active" : ""}
                onClick={() => setActiveId(section.id)}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        {active ? (
          <section>
            <header className="mb-4">
              <h2 className="text-lg font-semibold">{active.title}</h2>
              {active.description ? (
                <p className="text-sm text-base-content/60 mt-1">{active.description}</p>
              ) : null}
            </header>
            <SettingsSectionPanel section={active} platform={platform} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
