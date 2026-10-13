import type { EventPlatform, MessagePart } from "@/lib/events/types";

/**
 * Live chat tools as overlays and the dashboard see them (no voter lists or other bulk).
 * Pure types so both the browser and the server can use them.
 */

export type Participant = { key: string; name: string; platform: EventPlatform; avatarUrl?: string | null };

export type PublicPoll = {
  id: string;
  question: string;
  options: { label: string; votes: number }[];
  totalVotes: number;
  status: "open" | "closed";
  startedAt: string;
  endsAt: string | null;
};

export type PublicGiveaway = {
  id: string;
  title: string;
  keyword: string;
  status: "open" | "closed";
  entries: number;
  /** Most recent entrants first, up to 30 (the overlay's name reel). */
  recent: Participant[];
  winners: (Participant & { at: string })[];
  startedAt: string;
};

export type PublicQueue = { open: boolean; title: string; entries: (Participant & { at: string })[]; current: (Participant & { at: string }) | null };

export type Highlight = { id: string; platform: EventPlatform; name: string; avatarUrl?: string | null; color?: string | null; badges?: string[]; message: string; messageParts?: MessagePart[]; at: string };

export type PublicLiveTools = { poll: PublicPoll | null; giveaway: PublicGiveaway | null; queue: PublicQueue; highlight: Highlight | null };

export function emptyLiveTools(): PublicLiveTools {
  return { poll: null, giveaway: null, queue: { open: false, title: "Viewer queue", entries: [], current: null }, highlight: null };
}

/** The number a chat message votes for: "2", "!vote 2", "#2" or an option's exact text. */
export function parseVote(message: string, options: string[]): number | null {
  const text = message.trim();
  const number = /^(?:!vote\s+)?#?(\d{1,2})$/i.exec(text);
  if (number) {
    const index = Number(number[1]) - 1;
    return index >= 0 && index < options.length ? index : null;
  }
  const exact = options.findIndex((option) => option.trim().toLowerCase() === text.toLowerCase());
  return exact >= 0 ? exact : null;
}
