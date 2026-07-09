import { m } from "@paraglide/messages";

type SidebarMessageFn = (typeof m)["sidebar_home"];

/** Starlight sidebar 需要 en label + zh-CN translation，用 Paraglide 按 locale 取文案 */
function t(fn: SidebarMessageFn): { label: string; translations: { "zh-CN": string } } {
  return {
    label: fn({}, { locale: "en" }),
    translations: { "zh-CN": fn({}, { locale: "zh-cn" }) },
  };
}

export const starlightSidebar = [
  { ...t(m.sidebar_home), link: "/" },
  {
    ...t(m.sidebar_docs),
    items: [
      { ...t(m.sidebar_overview), link: "/docs/" },
      {
        ...t(m.sidebar_guide),
        collapsed: true,
        items: [
          { ...t(m.sidebar_install), link: "/docs/guide/install/" },
          { ...t(m.sidebar_security), link: "/docs/guide/security/" },
          { ...t(m.sidebar_database), link: "/docs/guide/database/" },
          { ...t(m.sidebar_service), link: "/docs/guide/service/" },
        ],
      },
      {
        ...t(m.sidebar_concepts),
        collapsed: true,
        items: [
          { ...t(m.sidebar_architecture), link: "/docs/concepts/architecture/" },
          { ...t(m.sidebar_identity), link: "/docs/concepts/identity/" },
          { ...t(m.sidebar_self_layer), link: "/docs/concepts/self-layer/" },
          { ...t(m.sidebar_memory), link: "/docs/concepts/memory/" },
          { ...t(m.sidebar_compression), link: "/docs/concepts/compression/" },
          { ...t(m.sidebar_sleep), link: "/docs/concepts/sleep/" },
          { ...t(m.sidebar_time_perception), link: "/docs/concepts/time-perception/" },
          { ...t(m.sidebar_recall_flow), link: "/docs/concepts/recall-flow/" },
        ],
      },
      {
        ...t(m.sidebar_features),
        collapsed: true,
        items: [{ ...t(m.sidebar_mobile_app), link: "/docs/features/mobile-app/" }],
      },
      {
        ...t(m.sidebar_sap),
        collapsed: true,
        items: [
          { ...t(m.sidebar_sap_overview), link: "/docs/sap/overview/" },
          { ...t(m.sidebar_sap_transport), link: "/docs/sap/transport/" },
          { ...t(m.sidebar_sap_methods), link: "/docs/sap/methods/" },
          { ...t(m.sidebar_sap_events), link: "/docs/sap/events/" },
          { ...t(m.sidebar_sap_tools), link: "/docs/sap/tools/" },
          { ...t(m.sidebar_sap_satellite_guide), link: "/docs/sap/satellite-guide/" },
          { ...t(m.sidebar_sap_security), link: "/docs/sap/security-model/" },
        ],
      },
      {
        ...t(m.sidebar_tools),
        collapsed: true,
        items: [{ ...t(m.sidebar_runtimes), link: "/docs/tools/execute-code-runtimes/" }],
      },
    ],
  },
];
