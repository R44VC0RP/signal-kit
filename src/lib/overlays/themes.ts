import { sanitizeSettings, type AlertSettings, type AnySettings, type Appearance, type ChatSettings, type GoalSettings, type OverlayType } from "./settings";

/**
 * Theme packs: one click restyles every overlay (alerts, chat, goals, labels…) so they match,
 * the way paid theme packs do elsewhere. A theme sets look and motion only; alert text, art,
 * sounds, events and filters stay as the streamer set them.
 */

type Look = Pick<Appearance, "style" | "font" | "fontWeight" | "textColor" | "accentColor" | "panelColor" | "panelOpacity" | "radius" | "textShadow">;

export type Theme = {
  id: string;
  name: string;
  description: string;
  look: Look;
  alerts: Partial<Pick<AlertSettings, "animationIn" | "animationOut" | "textAnimation" | "layout" | "messageColor">>;
  chat: Partial<Pick<ChatSettings, "layout" | "animation" | "font" | "fontWeight" | "fontSize" | "panelOpacity">>;
  goal: Pick<GoalSettings, "barColor" | "barBackground" | "barTextColor">;
};

export const THEMES: Theme[] = [
  {
    id: "classic",
    name: "Classic",
    description: "The look everyone knows: white outlined text, teal highlights.",
    look: { style: "classic", font: "open-sans", fontWeight: 800, textColor: "#ffffff", accentColor: "#32c3a6", panelColor: "#000000", panelOpacity: 0, radius: 0, textShadow: "outline" },
    alerts: { animationIn: "fadeIn", animationOut: "fadeOut", textAnimation: "wiggle", layout: "above", messageColor: "#ffffff" },
    chat: { layout: "inline", animation: "fadeInRight", font: "roboto", fontWeight: 700 },
    goal: { barColor: "#32c3a6", barBackground: "#2a2a2a", barTextColor: "#ffffff" },
  },
  {
    id: "neon",
    name: "Neon Arcade",
    description: "Hot magenta glow on deep purple, for late-night gaming.",
    look: { style: "classic", font: "orbitron", fontWeight: 800, textColor: "#ffffff", accentColor: "#ff2bd6", panelColor: "#12002b", panelOpacity: 0.6, radius: 10, textShadow: "glow" },
    alerts: { animationIn: "zoomIn", animationOut: "zoomOut", textAnimation: "pulse", layout: "above", messageColor: "#f3d9ff" },
    chat: { layout: "boxed", animation: "zoomIn", font: "exo2", fontWeight: 700, panelOpacity: 0.6 },
    goal: { barColor: "#ff2bd6", barBackground: "#1d0a3a", barTextColor: "#ffffff" },
  },
  {
    id: "cozy",
    name: "Cozy Café",
    description: "Warm cream and caramel with soft rounded type.",
    look: { style: "classic", font: "fredoka", fontWeight: 600, textColor: "#4a2f1d", accentColor: "#d9772b", panelColor: "#fff4e3", panelOpacity: 0.95, radius: 18, textShadow: "none" },
    alerts: { animationIn: "bounceIn", animationOut: "bounceOut", textAnimation: "wave", layout: "above", messageColor: "#6b4630" },
    chat: { layout: "boxed", animation: "fadeInUp", font: "fredoka", fontWeight: 600, panelOpacity: 0.95 },
    goal: { barColor: "#d9772b", barBackground: "#f3dcc0", barTextColor: "#4a2f1d" },
  },
  {
    id: "pixel",
    name: "Retro Pixel",
    description: "8-bit type, phosphor green, hard black shadows.",
    look: { style: "classic", font: "press-start", fontWeight: 400, textColor: "#eaffea", accentColor: "#39ff6a", panelColor: "#000000", panelOpacity: 0.75, radius: 0, textShadow: "heavy" },
    alerts: { animationIn: "flipInX", animationOut: "flipOutX", textAnimation: "shakeX", layout: "above", messageColor: "#eaffea" },
    chat: { layout: "boxed", animation: "fadeInLeft", font: "press-start", fontWeight: 400, fontSize: 14, panelOpacity: 0.75 },
    goal: { barColor: "#39ff6a", barBackground: "#0f2a14", barTextColor: "#000000" },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean white type with a soft shadow, no panels.",
    look: { style: "classic", font: "inter", fontWeight: 600, textColor: "#ffffff", accentColor: "#8ab4ff", panelColor: "#000000", panelOpacity: 0, radius: 8, textShadow: "soft" },
    alerts: { animationIn: "fadeInUp", animationOut: "fadeOutUp", textAnimation: "none", layout: "above", messageColor: "#e5e5e5" },
    chat: { layout: "inline", animation: "fadeInUp", font: "inter", fontWeight: 600 },
    goal: { barColor: "#8ab4ff", barBackground: "#262626", barTextColor: "#ffffff" },
  },
  {
    id: "comic",
    name: "Comic Pop",
    description: "Comic-book lettering, thick outlines, loud colours.",
    look: { style: "bold", font: "bangers", fontWeight: 400, textColor: "#111111", accentColor: "#ff3b30", panelColor: "#ffd60a", panelOpacity: 1, radius: 16, textShadow: "none" },
    alerts: { animationIn: "jackInTheBox", animationOut: "bounceOut", textAnimation: "tada", messageColor: "#111111" },
    chat: { animation: "bounceIn", font: "bangers", fontWeight: 400 },
    goal: { barColor: "#ff3b30", barBackground: "#111111", barTextColor: "#ffffff" },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark navy panels, periwinkle accents, calm motion.",
    look: { style: "signal", font: "outfit", fontWeight: 500, textColor: "#eef2ff", accentColor: "#7c9cff", panelColor: "#0b1020", panelOpacity: 0.85, radius: 20, textShadow: "none" },
    alerts: { animationIn: "backInDown", animationOut: "backOutUp", textAnimation: "none", messageColor: "#c7d2fe" },
    chat: { animation: "fadeInUp", font: "outfit", fontWeight: 500 },
    goal: { barColor: "#7c9cff", barBackground: "#151c33", barTextColor: "#ffffff" },
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Pastel pink with plum panels and a gentle wave.",
    look: { style: "classic", font: "nunito", fontWeight: 800, textColor: "#ffffff", accentColor: "#ff8fb8", panelColor: "#3a1029", panelOpacity: 0.55, radius: 14, textShadow: "outline" },
    alerts: { animationIn: "fadeInDown", animationOut: "fadeOutUp", textAnimation: "wave", layout: "above", messageColor: "#ffe4ef" },
    chat: { layout: "boxed", animation: "fadeInRight", font: "nunito", fontWeight: 700, panelOpacity: 0.55 },
    goal: { barColor: "#ff8fb8", barBackground: "#4a1f38", barTextColor: "#ffffff" },
  },
  {
    id: "esports",
    name: "Esports",
    description: "Hard-edged red and black with fast, aggressive motion.",
    look: { style: "classic", font: "russo", fontWeight: 400, textColor: "#ffffff", accentColor: "#ff2e3a", panelColor: "#0d0d0d", panelOpacity: 0.8, radius: 2, textShadow: "heavy" },
    alerts: { animationIn: "lightSpeedInLeft", animationOut: "lightSpeedOutRight", textAnimation: "shakeX", layout: "side", messageColor: "#ffffff" },
    chat: { layout: "columns", animation: "slideInLeft", font: "barlow", fontWeight: 800, panelOpacity: 0.8 },
    goal: { barColor: "#ff2e3a", barBackground: "#222222", barTextColor: "#ffffff" },
  },
];

export function findTheme(id: unknown) {
  return THEMES.find((theme) => theme.id === id) ?? null;
}

/** An overlay's settings restyled with a theme; everything the theme doesn't cover is kept. */
export function applyTheme(type: OverlayType, settings: AnySettings, theme: Theme): AnySettings {
  const next: Record<string, unknown> = { ...settings, ...theme.look };
  if (type === "alerts") {
    Object.assign(next, theme.alerts);
  }
  if (type === "chat" || type === "events" || type === "ticker" || type === "label") {
    // Text-heavy overlays use the theme's reading font; chat also takes its layout and motion.
    const { layout, animation, fontSize, ...type_ } = theme.chat;
    Object.assign(next, type_);
    if (type === "chat") {
      Object.assign(next, { layout, animation, ...(fontSize ? { fontSize } : {}) });
    }
    if (type === "events" && animation) {
      next.animation = animation;
    }
  }
  if (type === "goal") {
    Object.assign(next, theme.goal);
  }
  return sanitizeSettings(type, next);
}
