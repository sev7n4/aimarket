export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export type CanvasTheme = {
  canvas: {
    background: string;
    dot: string;
    line: string;
    selectionStroke: string;
    selectionFill: string;
  };
  node: {
    label: string;
    fill: string;
    panel: string;
    stroke: string;
    activeStroke: string;
    placeholder: string;
    text: string;
    muted: string;
    faint: string;
  };
  toolbar: {
    panel: string;
    border: string;
    item: string;
    itemHover: string;
    activeBg: string;
    activeText: string;
  };
};

// Adapted from infinite-canvas canvasThemes.dark, mapped to aimarket CSS variables
export const canvasTheme: CanvasTheme = {
  canvas: {
    background: "var(--am-bg, #050505)",
    dot: "rgba(245,245,244,.24)",
    line: "rgba(245,245,244,.10)",
    selectionStroke: "#fafaf9",
    selectionFill: "rgba(250,250,249,.10)",
  },
  node: {
    label: "#d6d3d1",
    fill: "var(--am-surface, rgba(255,255,255,0.04))",
    panel: "var(--am-surface-strong, rgba(255,255,255,0.08))",
    stroke: "var(--am-border, rgba(255,255,255,0.1))",
    activeStroke: "#fafaf9",
    placeholder: "#a8a29e",
    text: "#f5f5f4",
    muted: "#d6d3d1",
    faint: "#78716c",
  },
  toolbar: {
    panel: "var(--am-surface-strong, rgba(255,255,255,0.08))",
    border: "var(--am-border, rgba(255,255,255,0.1))",
    item: "#d6d3d1",
    itemHover: "rgba(255,255,255,0.04)",
    activeBg: "rgba(255,255,255,0.12)",
    activeText: "#f5f5f4",
  },
};
