import en from "../../../messages/en.json" with { type: "json" };
import zh from "../../../messages/zh-cn.json" with { type: "json" };

type MessageKey = keyof typeof en;

function t(key: MessageKey): { label: string; translations: { "zh-CN": string } } {
  return {
    label: en[key],
    translations: { "zh-CN": zh[key] },
  };
}

export const starlightSidebar = [
  { ...t("sidebar_home"), link: "/" },
  {
    ...t("sidebar_docs"),
    items: [
      { ...t("sidebar_overview"), link: "/docs/" },
      { ...t("sidebar_identity"), link: "/docs/identity/" },
      { ...t("sidebar_self_layer"), link: "/docs/self-layer/" },
      { ...t("sidebar_memory"), link: "/docs/memory/" },
      { ...t("sidebar_compression"), link: "/docs/compression/" },
      { ...t("sidebar_sleep"), link: "/docs/sleep/" },
      { ...t("sidebar_security"), link: "/docs/security/" },
      { ...t("sidebar_database"), link: "/docs/database/" },
      { ...t("sidebar_versioning"), link: "/docs/versioning/" },
      {
        ...t("sidebar_designs"),
        collapsed: true,
        items: [
          { ...t("sidebar_recall_flow"), link: "/docs/designs/recall-flow/" },
          { ...t("sidebar_time_perception"), link: "/docs/designs/time-perception/" },
          { ...t("sidebar_pair_programming"), link: "/docs/designs/pair-programming-v1/" },
          { ...t("sidebar_runtimes"), link: "/docs/designs/execute-code-runtimes/" },
          { ...t("sidebar_probe_architecture"), link: "/docs/designs/probe-architecture/" },
          { ...t("sidebar_desktop_companion"), link: "/docs/designs/desktop-companion/" },
          { ...t("sidebar_migration_plan"), link: "/docs/designs/issue-1-migration-plan/" },
        ],
      },
    ],
  },
];
