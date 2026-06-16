/** Site-aligned Mermaid `base` theme (hex only — khroma cannot parse CSS vars). */

const fontFamily = '"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif';

function palette(mode: "dark" | "light"): Record<string, string | boolean> {
  if (mode === "light") {
    return {
      darkMode: false,
      background: "#f5f3f0",
      mainBkg: "#e8e4dc",
      secondBkg: "#edeae6",
      tertiaryColor: "#dedad4",
      primaryColor: "#e8e4dc",
      primaryTextColor: "#1a1917",
      secondaryColor: "#e2dfd9",
      secondaryTextColor: "#4a4742",
      tertiaryTextColor: "#5a5650",
      primaryBorderColor: "#d0cdc7",
      secondaryBorderColor: "#d0cdc7",
      tertiaryBorderColor: "#d0cdc7",
      lineColor: "#9c9890",
      textColor: "#1a1917",
      nodeBorder: "#d0cdc7",
      clusterBkg: "#edeae6",
      clusterBorder: "#d0cdc7",
      titleColor: "#1a1917",
      edgeLabelBackground: "#f5f3f0",
      defaultLinkColor: "#9c9890",
      fontFamily,
      fontSize: "14px",
      actorBkg: "#e8e4dc",
      actorBorder: "#d0cdc7",
      actorTextColor: "#1a1917",
      actorLineColor: "#d0cdc7",
      signalColor: "#9c9890",
      labelBoxBkgColor: "#f5f3f0",
      labelBoxBorderColor: "#d0cdc7",
      labelTextColor: "#4a4742",
      loopTextColor: "#5a5650",
      noteBkgColor: "#e8e4dc",
      noteBorderColor: "#d0cdc7",
      noteTextColor: "#1a1917",
      activationBorderColor: "#d0cdc7",
      activationBkgColor: "#e2dfd9",
      sequenceNumberColor: "#1a1917",
      sectionBkgColor: "#e2dfd9",
      altSectionBkgColor: "#f5f3f0",
      gridColor: "#d0cdc7",
      cScale0: "#e8e4dc",
      cScale1: "#dedad4",
      cScale2: "#e2dfd9",
      cScaleLabel0: "#1a1917",
      cScaleLabel1: "#1a1917",
      cScaleLabel2: "#1a1917",
    };
  }

  return {
    darkMode: true,
    background: "#0a0a0b",
    // Flowchart / topology — slightly brighter than sequence actors
    mainBkg: "#403e3a",
    secondBkg: "#2a2825",
    tertiaryColor: "#3a3834",
    primaryColor: "#403e3a",
    primaryTextColor: "#e8e6e3",
    secondaryColor: "#4a4742",
    secondaryTextColor: "#b8b4ad",
    tertiaryTextColor: "#9c9890",
    primaryBorderColor: "#5a5650",
    secondaryBorderColor: "#5a5650",
    tertiaryBorderColor: "#5a5650",
    lineColor: "#7a7670",
    textColor: "#e8e6e3",
    nodeBorder: "#5a5650",
    clusterBkg: "#222120",
    clusterBorder: "#5a5650",
    titleColor: "#e8e6e3",
    edgeLabelBackground: "#2a2825",
    defaultLinkColor: "#7a7670",
    fontFamily,
    fontSize: "14px",
    // Sequence — keep prior contrast (user-preferred brightness)
    actorBkg: "#2a2825",
    actorBorder: "#3a3834",
    actorTextColor: "#e8e6e3",
    actorLineColor: "#3a3834",
    signalColor: "#5a5650",
    labelBoxBkgColor: "#111110",
    labelBoxBorderColor: "#3a3834",
    labelTextColor: "#b8b4ad",
    loopTextColor: "#9c9890",
    noteBkgColor: "#2a2825",
    noteBorderColor: "#3a3834",
    noteTextColor: "#e8e6e3",
    activationBorderColor: "#3a3834",
    activationBkgColor: "#1e1c1a",
    sequenceNumberColor: "#e8e6e3",
    sectionBkgColor: "#1e1c1a",
    altSectionBkgColor: "#111110",
    gridColor: "#3a3834",
    cScale0: "#403e3a",
    cScale1: "#4a4742",
    cScale2: "#3a3834",
    cScaleLabel0: "#e8e6e3",
    cScaleLabel1: "#e8e6e3",
    cScaleLabel2: "#e8e6e3",
  };
}

export const faMermaidThemeDark = palette("dark");
export const faMermaidThemeLight = palette("light");

export function faMermaidThemeForDocument(
  doc: Pick<Document, "documentElement">,
): typeof faMermaidThemeDark {
  return doc.documentElement.getAttribute("data-theme") === "light"
    ? faMermaidThemeLight
    : faMermaidThemeDark;
}

export const faMermaidConfig = {
  theme: "base" as const,
  autoTheme: false,
  enableLog: false,
  mermaidConfig: {
    themeVariables: faMermaidThemeDark,
    flowchart: {
      htmlLabels: true,
      curve: "basis",
    },
  },
};
