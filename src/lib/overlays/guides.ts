/**
 * How to add a browser-source overlay in each streaming app. `{url}`, `{width}` and `{height}`
 * are filled in with the overlay's values. Menu names as they appear in each app (2026).
 * Twitch Studio is omitted: it was discontinued in May 2024.
 */
export type SetupGuide = { app: string; id: string; steps: string[]; tip?: string };

export const SETUP_GUIDES: SetupGuide[] = [
  {
    app: "OBS Studio",
    id: "obs",
    steps: [
      "Select the scene you stream with, then in Sources click + and choose Browser.",
      "Choose Create new, name it (for example “Signal Kit alerts”), and click OK.",
      "Paste your overlay URL into URL, and set Width to {width} and Height to {height}.",
      "Tick “Control audio via OBS” so alert sounds show up in your audio mixer, then click OK.",
      "Drag the source to the top of the Sources list so it sits above your game and camera.",
    ],
    tip: "Add the same source to every scene with right-click → Copy, then Paste (Reference) in the other scenes.",
  },
  {
    app: "Streamlabs Desktop",
    id: "streamlabs",
    steps: [
      "In the Editor, click + above Sources.",
      "Choose Browser Source, name it, and click Add Source.",
      "Paste your overlay URL, set Width to {width} and Height to {height}, and click Done.",
      "For chat, untick “Shutdown source when not visible” so messages aren't cleared when you switch scenes.",
    ],
  },
  {
    app: "XSplit Broadcaster",
    id: "xsplit",
    steps: [
      "Click Add Source and choose Webpage.",
      "Paste your overlay URL and click OK.",
      "In the source's properties, set the size to {width} × {height} under Display.",
    ],
  },
  {
    app: "Meld Studio",
    id: "meld",
    steps: [
      "In the Layers panel, click + and choose Browser.",
      "Paste your overlay URL in the Inspector and set the size to {width} × {height}.",
    ],
    tip: "Shortcut: paste the URL straight onto the canvas and Meld creates the browser layer for you.",
  },
  {
    app: "vMix",
    id: "vmix",
    steps: [
      "Click Add Input and choose Web Browser.",
      "Paste your overlay URL and set Width to {width} and Height to {height}.",
      "Position it with Input Settings → Position, then add it as an overlay on your output.",
    ],
  },
];

export function fillGuide(step: string, values: { width: number; height: number }) {
  return step.replaceAll("{width}", String(values.width)).replaceAll("{height}", String(values.height));
}
