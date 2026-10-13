import type { Metadata } from "next";
import { OverlayRuntime } from "@/components/overlay/OverlayRuntime";
import { sanitizeSettings } from "@/lib/overlays/settings";
import { findOverlayByToken } from "@/lib/overlays/store";

export const metadata: Metadata = { title: "Signal Kit overlay", robots: { index: false, follow: false } };

/** The browser-source page streamers paste into OBS. Transparent; shows only the overlay. */
export default async function OverlayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const overlay = await findOverlayByToken(token);
  return (
    <>
      {/* Browser sources composite this page over the stream, so nothing may paint a background. */}
      <style>{"html,body{background:transparent!important;margin:0;overflow:hidden}"}</style>
      {overlay ? (
        <OverlayRuntime token={token} overlayId={overlay.id} type={overlay.type} initialSettings={sanitizeSettings(overlay.type, overlay.settings)} />
      ) : (
        <p style={{ margin: 24, font: "500 16px system-ui", color: "#f5f5f5", textShadow: "0 1px 3px #000" }}>
          This overlay URL no longer works. Copy the current URL from your Signal Kit dashboard.
        </p>
      )}
    </>
  );
}
