/**
 * Official Twitch and YouTube marks, from each company's own brand kit (copies in
 * signalkit-design/twitch-brand and signalkit-design/youtube-brand):
 * - Twitch Glitch (brand.twitch.com, Twitch-Brand.zip): Twitch Purple #9146FF with a white
 *   inside, or flat white. Twitch's rules: don't modify or recolour the logo.
 * - YouTube icon (brand.youtube/youtube-icon, youtube-icon.zip, converted from the official
 *   .ai): YouTube Red #FF0033 with a white play triangle. Note it's #FF0033, not the old #FF0000.
 */

export const TWITCH_PURPLE = "#9146FF";
export const YOUTUBE_RED = "#FF0033";

/** Twitch Glitch, official geometry (2400×2800). Renders `height` tall, 6:7 wide. */
export function TwitchGlitch({ height = 16, mono = false }: { height?: number; mono?: boolean }) {
  return (
    <svg width={(height * 6) / 7} height={height} viewBox="0 0 2400 2800" role="img" aria-label="Twitch" style={{ flexShrink: 0 }}>
      {mono ? null : <polygon fill="#FFFFFF" points="2200,1300 1800,1700 1400,1700 1050,2050 1050,1700 600,1700 600,200 2200,200" />}
      <g fill={mono ? "currentColor" : TWITCH_PURPLE}>
        <path d="M500,0L0,500v1800h600v500l500-500h400l900-900V0H500z M2200,1300l-400,400h-400l-350,350v-350H600V200h1600V1300z" />
        <rect x="1700" y="550" width="200" height="600" />
        <rect x="1150" y="550" width="200" height="600" />
      </g>
    </svg>
  );
}

/** YouTube icon, official geometry cropped to the mark (about 1.43:1). Renders `width` wide. */
export function YouTubeIcon({ width = 18, mono = false }: { width?: number; mono?: boolean }) {
  return (
    <svg width={width} height={width / 1.4275} viewBox="102.83 119.05 396.53 277.78" role="img" aria-label="YouTube" style={{ flexShrink: 0 }}>
      <path
        transform="matrix(1,0,0,-1,261.5556,317.45698)"
        fill={mono ? "currentColor" : YOUTUBE_RED}
        d="M0 0 102.827 59.668 0 119.046ZM-115.28-70.965C-132.37-66.33-145.694-52.717-150.618-35.917-158.728-4.924-158.728 59.668-158.728 59.668-158.728 59.668-158.728 124.26-150.618 154.963-145.694 172.052-132.37 185.377-115.28 190.011-84.577 198.411 39.393 198.411 39.393 198.411 39.393 198.411 163.653 198.411 194.357 190.011 211.736 185.377 224.77 172.052 229.405 154.963 237.804 124.26 237.804 59.668 237.804 59.668 237.804 59.668 237.804-4.924 229.405-35.917 224.77-52.717 211.736-66.33 194.357-70.965 163.653-79.365 39.393-79.365 39.393-79.365 39.393-79.365-84.577-79.365-115.28-70.965"
      />
      {mono ? null : <path transform="matrix(1,0,0,-1,261.5556,317.45698)" fill="#FFFFFF" d="M0 0 102.827 59.668 0 119.046Z" />}
    </svg>
  );
}

/**
 * YouTube live-chat role icons, drawn to match how YouTube shows them: a moderator wrench in
 * YouTube's moderator blue and a verified check. YouTube publishes no API or asset for these.
 */
export function YouTubeModeratorIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Moderator" style={{ flexShrink: 0 }}>
      <path
        fill="#5E84F1"
        d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"
      />
    </svg>
  );
}

export function YouTubeVerifiedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified" style={{ flexShrink: 0 }}>
      <path fill="#AAAAAA" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.8 14.6-4.3-4.3 1.4-1.4 2.9 2.9 6.4-6.4 1.4 1.4-7.8 7.8z" />
    </svg>
  );
}
