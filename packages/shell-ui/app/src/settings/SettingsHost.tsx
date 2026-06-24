import { useMemo, useState } from "react";
import type { FrontendSettingsExport, SettingsPlatform } from "@freeanima/satellite-sdk";
import { listSettingsSectionsForPlatform } from "@freeanima/satellite-sdk";

import { SettingsSectionPanel } from "./SettingsSectionPanel.tsx";

type Props = {
  exports: FrontendSettingsExport[];
  platform: SettingsPlatform;
};

export function SettingsHost({ exports, platform }: Props) {
  const sections = useMemo(
    () => listSettingsSectionsForPlatform(exports, platform),
    [exports, platform],
  );
  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? "");

  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  if (sections.length === 0) {
    return <p className="p-6 text-sm text-base-content/60">暂无可用设置</p>;
  }

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-52 shrink-0 border-r border-base-300 bg-base-200/40 p-3 overflow-y-auto">
        <ul className="menu menu-sm gap-0.5">
          {sections.map((section) => (
            <li key={`${section.appId}:${section.id}`}>
              <button
                type="button"
                className={
                  active?.id === section.id && active?.appId === section.appId ? "active" : ""
                }
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
