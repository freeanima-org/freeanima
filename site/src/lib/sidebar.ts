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
      {
        ...t("sidebar_guide"),
        collapsed: true,
        items: [
          { ...t("sidebar_install"), link: "/docs/guide/install/" },
          { ...t("sidebar_security"), link: "/docs/guide/security/" },
          { ...t("sidebar_database"), link: "/docs/guide/database/" },
          { ...t("sidebar_service"), link: "/docs/guide/service/" },
        ],
      },
      {
        ...t("sidebar_concepts"),
        collapsed: true,
        items: [
          { ...t("sidebar_architecture"), link: "/docs/concepts/architecture/" },
          { ...t("sidebar_identity"), link: "/docs/concepts/identity/" },
          { ...t("sidebar_self_layer"), link: "/docs/concepts/self-layer/" },
          { ...t("sidebar_memory"), link: "/docs/concepts/memory/" },
          { ...t("sidebar_compression"), link: "/docs/concepts/compression/" },
          { ...t("sidebar_sleep"), link: "/docs/concepts/sleep/" },
          { ...t("sidebar_time_perception"), link: "/docs/concepts/time-perception/" },
          { ...t("sidebar_recall_flow"), link: "/docs/concepts/recall-flow/" },
        ],
      },
      {
        ...t("sidebar_features"),
        collapsed: true,
        items: [{ ...t("sidebar_pair_programming"), link: "/docs/features/pair-programming-v1/" }],
      },
      {
        ...t("sidebar_tools"),
        collapsed: true,
        items: [{ ...t("sidebar_runtimes"), link: "/docs/tools/execute-code-runtimes/" }],
      },
    ],
  },
];
