import { useId } from "react";

/**
 * X brand marks from the X Partner Icon Kit (X's design system, shared by X for partners;
 * full kit in signalkit-design/x-partner-icon-kit). Rules from the kit: the X logo is one solid
 * colour, never stretched, rotated, gradient-filled or shadowed, and at least 16px.
 */

/** The current X mark (24×24 viewBox, includes the kit's built-in clear space). */
export const X_LOGO_PATH = "m21.62 21.5-7.47-10.9 6.97-8.1H18.7l-5.62 6.54L8.6 2.5H2.48L9.68 13l-7.3 8.5H4.8l5.96-6.93 4.76 6.93zM7.8 4.03l10.93 15.94H16.3L5.38 4.03z";

const VERIFIED: Record<"blue" | "business" | "government", string> = {
  "blue": "<path fill=\"#1d9bf0\" fill-rule=\"evenodd\" d=\"M12 1.75c1.4 0 2.62.87 3.34 2.19 1.44-.43 2.92-.17 3.91.81s1.24 2.47.81 3.91c1.32.72 2.2 1.94 2.2 3.34s-.88 2.62-2.2 3.34c.43 1.44.18 2.92-.81 3.9-.99 1-2.47 1.25-3.91.82-.72 1.32-1.94 2.19-3.34 2.19s-2.62-.87-3.34-2.2c-1.44.44-2.92.18-3.9-.8-1-.99-1.24-2.47-.82-3.91-1.32-.72-2.19-1.95-2.19-3.34 0-1.4.87-2.62 2.2-3.34-.43-1.44-.18-2.92.8-3.9.99-1 2.47-1.25 3.91-.82.72-1.32 1.95-2.19 3.34-2.19M10.45 13.3l-2.23-2.25-1.42 1.4 3.7 3.75 6.24-6.77-1.47-1.36z\" clip-rule=\"evenodd\"/>",
  "business": "<path fill=\"url(#SKX_GOLD_ID)\" fill-rule=\"evenodd\" d=\"M14.54 4.2 12 1.75 9.47 4.2l-3.5-.5-.6 3.48-3.12 1.65L3.8 12l-1.55 3.17 3.11 1.65.61 3.48 3.5-.5L12 22.25l2.54-2.45 3.49.5.6-3.48 3.12-1.65L20.2 12l1.55-3.17-3.11-1.65-.61-3.48zM6.8 12.46l3.74 3.74 6.2-6.77-1.47-1.36-4.8 5.23-2.26-2.26z\" clip-rule=\"evenodd\"/><path fill=\"url(#verified-business-gold-b)\" fill-rule=\"evenodd\" d=\"M14.3 4.95 12 2.73 9.7 4.95 6.56 4.5 6 7.64l-2.82 1.5L4.58 12l-1.4 2.87L6 16.37l.55 3.13 3.16-.44L12 21.27l2.3-2.21 3.15.44.55-3.14 2.82-1.5-1.4-2.86 1.4-2.87L18 7.64l-.55-3.14zm-7.5 7.51 3.74 3.74 6.2-6.77-1.47-1.36-4.8 5.23-2.26-2.26z\" clip-rule=\"evenodd\"/><path fill=\"#d18800\" fill-rule=\"evenodd\" d=\"m6.8 12.46 3.74 3.74 6.2-6.77v1.53l-6.2 6.77-3.74-3.74z\" clip-rule=\"evenodd\"/><defs><linearGradient id=\"SKX_GOLD_ID\" x1=\"4.81\" x2=\"19.73\" y1=\"2.72\" y2=\"23.46\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#f4e72a\"/><stop offset=\".54\" stop-color=\"#cd8105\"/><stop offset=\".68\" stop-color=\"#cb7b00\"/><stop offset=\"1\" stop-color=\"#f4e72a\"/></linearGradient><linearGradient id=\"verified-business-gold-b\" x1=\"5.84\" x2=\"17.85\" y1=\"3.7\" y2=\"20.87\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#f9e87f\"/><stop offset=\".41\" stop-color=\"#e2b719\"/><stop offset=\".99\" stop-color=\"#e2b719\"/></linearGradient></defs>",
  "government": "<path fill=\"#829aab\" fill-rule=\"evenodd\" d=\"M11.38 2.1a2 2 0 0 1 1.24 0c.46.15.85.54 1.64 1.33l.91.91h1.29c1.12 0 1.68 0 2.1.22q.58.3.88.88c.22.42.22.98.22 2.1v1.29l.9.9c.8.8 1.2 1.2 1.34 1.65a2 2 0 0 1 0 1.24c-.15.45-.54.85-1.33 1.64l-.91.91v1.28c0 1.12 0 1.69-.22 2.11a2 2 0 0 1-.88.88c-.42.21-.98.21-2.1.21h-1.29l-.9.91c-.8.8-1.2 1.2-1.65 1.34a2 2 0 0 1-1.24 0c-.45-.15-.85-.54-1.64-1.34l-.91-.9H7.55c-1.12 0-1.69 0-2.11-.22a2 2 0 0 1-.88-.88c-.22-.42-.22-.99-.22-2.1v-1.29l-.9-.9c-.8-.8-1.2-1.2-1.34-1.65a2 2 0 0 1 0-1.24c.15-.46.54-.85 1.34-1.64l.9-.91V7.54c0-1.12 0-1.68.22-2.1a2 2 0 0 1 .88-.88c.42-.22.99-.22 2.1-.22h1.29l.9-.9c.8-.8 1.2-1.2 1.65-1.34m-.87 11.17-2.2-2.2-1.38 1.38 3.65 3.65 6.04-6.6-1.43-1.33z\" clip-rule=\"evenodd\"/>"
};

/** X's verified badge: Premium blue, Business gold or Government gray, in production colours. */
export function XVerifiedBadge({ type, size = 16 }: { type: "blue" | "business" | "government"; size?: number }) {
  // The gold badge uses an SVG gradient; give each instance its own id.
  const id = useId().replace(/:/g, "");
  const markup = type === "business" ? VERIFIED.business.replaceAll("SKX_GOLD_ID", `skx-gold-${id}`) : VERIFIED[type];
  const label = type === "business" ? "Verified organization" : type === "government" ? "Verified government" : "Verified";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
