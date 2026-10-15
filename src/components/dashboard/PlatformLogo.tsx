import { TwitchGlitch, YOUTUBE_MIN_ICON_HEIGHT, YouTubeIcon } from "@/components/brand/platforms";
import { X_LOGO_PATH } from "@/components/brand/x";
import type { Platform } from "@/db/schema";

// Official marks from each platform's brand kit: Twitch Glitch (#9146FF), YouTube icon
// (#FF0033), and X's current mark (white, from the X Partner Icon Kit).
// YouTube's branding rules apply wherever its icon shows: at least 20px tall (the red shape),
// full colour, with its clear space (built into YouTubeIcon's box) kept free.

export const PLATFORM_NAME: Record<Platform, string> = { twitch: "Twitch", youtube: "YouTube", x: "X" };

/**
 * `size` is the visual height budget; each mark keeps its own official proportions. YouTube's icon
 * never goes below its 20px minimum and brings its clear space, so its box is larger (43 × 37 px
 * at the minimum): leave room for it.
 */
export function PlatformLogo({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === "twitch") {
    return <TwitchGlitch height={size} />;
  }
  if (platform === "youtube") {
    return <YouTubeIcon height={Math.max(YOUTUBE_MIN_ICON_HEIGHT, size)} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="X" role="img" style={{ flexShrink: 0 }}>
      <path d={X_LOGO_PATH} fill="#FFFFFF" />
    </svg>
  );
}

/** A logo in a column as wide as YouTube's icon box (44px), so mixed-platform lists stay aligned. */
export function PlatformSlot({ platform, size }: { platform: Platform; size?: number }) {
  return (
    <span className="flex w-11 shrink-0 justify-center">
      <PlatformLogo platform={platform} size={size} />
    </span>
  );
}

/**
 * A 48px tile, large enough for the YouTube icon's clear-space box so the tile's border stays
 * clear of it. YouTube's icon must lead to YouTube: pass `href` (a channel URL or youtube.com) and
 * `label` to make the tile a link that opens in a new tab.
 */
export function PlatformTile({ platform, href, label }: { platform: Platform; href?: string; label?: string }) {
  const className = "flex size-12 shrink-0 items-center justify-center rounded-(--r) border border-(--line) bg-(--hover)";
  const logo = <PlatformLogo platform={platform} size={20} />;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={`${className} hover:border-(--line-strong)`}>
        {logo}
      </a>
    );
  }
  return <div className={className}>{logo}</div>;
}

/** Where a platform's mark should link: the channel itself on YouTube (YouTube's branding rules). */
export function channelUrl(platform: Platform, platformUserId: string) {
  return platform === "youtube" ? `https://www.youtube.com/channel/${encodeURIComponent(platformUserId)}` : undefined;
}
