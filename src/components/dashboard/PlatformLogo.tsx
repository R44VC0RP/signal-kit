import type { Platform } from "@/db/schema";

// Official marks via Simple Icons (CC0), in each brand's colors.
const TWITCH =
  "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z";
const YOUTUBE =
  "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
const X =
  "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z";

export const PLATFORM_NAME: Record<Platform, string> = { twitch: "Twitch", youtube: "YouTube", x: "X" };

export function PlatformLogo({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === "twitch") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Twitch" role="img">
        <path d="M6.857 1.714h13.714v9.429l-3.428 3.428h-3.429l-3 3v-3H6.857z" fill="#FFFFFF" />
        <path d={TWITCH} fill="#9146FF" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg width={size + 2} height={size + 2} viewBox="0 0 24 24" aria-label="YouTube" role="img">
        <path d="M9.545 15.568V8.432L15.818 12z" fill="#FFFFFF" />
        <path d={YOUTUBE} fill="#FF0000" />
      </svg>
    );
  }
  return (
    <svg width={size - 2} height={size - 2} viewBox="0 0 24 24" aria-label="X" role="img">
      <path d={X} fill="#FFFFFF" />
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
