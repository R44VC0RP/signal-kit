import { TwitchGlitch, YouTubeIcon } from "@/components/brand/platforms";
import { X_LOGO_PATH } from "@/components/brand/x";
import type { Platform } from "@/db/schema";

// Official marks from each platform's brand kit: Twitch Glitch (#9146FF), YouTube icon
// (#FF0033), and X's current mark (white, from the X Partner Icon Kit).

export const PLATFORM_NAME: Record<Platform, string> = { twitch: "Twitch", youtube: "YouTube", x: "X" };

/** `size` is the visual height budget; each mark keeps its own official proportions. */
export function PlatformLogo({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === "twitch") {
    return <TwitchGlitch height={size} />;
  }
  if (platform === "youtube") {
    return <YouTubeIcon width={size + 2} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="X" role="img" style={{ flexShrink: 0 }}>
      <path d={X_LOGO_PATH} fill="#FFFFFF" />
    </svg>
  );
}

export function PlatformTile({ platform }: { platform: Platform }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-(--r) border border-(--line) bg-(--hover)">
      <PlatformLogo platform={platform} />
    </div>
  );
}
