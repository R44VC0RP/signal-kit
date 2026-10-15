import { randomInt, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { liveTools } from "@/db/schema";
import type { SignalKitEvent } from "@/lib/events/types";
import { isExpired } from "@/lib/retention/youtube-core";
import { relayHub } from "@/lib/ws/relay";
import { emptyLiveTools, parseVote, type Highlight, type Participant, type PublicLiveTools } from "./types";

/**
 * Polls, giveaways, a viewer queue and a pinned chat message, driven by chat on every
 * connected platform at once (viewers type "1", "!enter" or "!join" on Twitch, YouTube or X).
 * Only reads chat, so it needs no extra permissions. State is stored per user and pushed to
 * overlays; bursts of votes are batched into one push per 300 ms.
 *
 * YouTube retention (30 days, see lib/retention/youtube-core.ts): a poll or giveaway that started
 * more than 30 days ago is cleared (its votes and entrants are at most that old otherwise), and
 * YouTube queue entries and a pinned YouTube message go 30 days after they were added.
 */

type State = {
  poll: (Omit<NonNullable<PublicLiveTools["poll"]>, "options" | "totalVotes"> & { options: string[]; votes: Record<string, number> }) | null;
  giveaway: (Omit<NonNullable<PublicLiveTools["giveaway"]>, "entries" | "recent"> & { entrants: Participant[] }) | null;
  queue: PublicLiveTools["queue"];
  highlight: Highlight | null;
  wheel?: PublicLiveTools["wheel"];
};

const MAX_ENTRANTS = 50_000;
const MAX_QUEUE = 200;

function emptyState(): State {
  const empty = emptyLiveTools();
  return { poll: null, giveaway: null, queue: empty.queue, highlight: null };
}

/**
 * Deletes YouTube data older than 30 days, in place. With `all` (YouTube disconnected or access
 * revoked) it deletes every YouTube vote, entrant, winner, queue entry and pin instead, whatever
 * its age. Returns whether anything changed.
 */
export function pruneLiveTools(state: State, now = Date.now(), all = false) {
  let changed = false;
  if (all) {
    const isYouTube = (entry: { platform: string }) => entry.platform === "youtube";
    if (state.poll) {
      const votes = Object.fromEntries(Object.entries(state.poll.votes).filter(([key]) => !key.startsWith("youtube:")));
      if (Object.keys(votes).length !== Object.keys(state.poll.votes).length) {
        state.poll = { ...state.poll, votes };
        changed = true;
      }
    }
    if (state.giveaway) {
      const entrants = state.giveaway.entrants.filter((entry) => !isYouTube(entry));
      const winners = state.giveaway.winners.filter((entry) => !isYouTube(entry));
      if (entrants.length !== state.giveaway.entrants.length || winners.length !== state.giveaway.winners.length) {
        state.giveaway = { ...state.giveaway, entrants, winners };
        changed = true;
      }
    }
  } else {
    if (state.poll && isExpired(state.poll.startedAt, now)) {
      state.poll = null;
      changed = true;
    }
    if (state.giveaway && isExpired(state.giveaway.startedAt, now)) {
      state.giveaway = null;
      changed = true;
    }
  }
  const old = (entry: { platform: string; at?: string } | null | undefined) => Boolean(entry && entry.platform === "youtube" && (all || isExpired(entry.at, now)));
  const entries = state.queue.entries.filter((entry) => !old(entry));
  if (entries.length !== state.queue.entries.length) {
    state.queue = { ...state.queue, entries };
    changed = true;
  }
  if (old(state.queue.current)) {
    state.queue = { ...state.queue, current: null };
    changed = true;
  }
  if (old(state.highlight)) {
    state.highlight = null;
    changed = true;
  }
  return changed;
}

export function publicTools(state: State): PublicLiveTools {
  const poll = state.poll
    ? (() => {
        const counts = state.poll.options.map(() => 0);
        for (const index of Object.values(state.poll.votes)) {
          counts[index] = (counts[index] ?? 0) + 1;
        }
        const { id, question, status, startedAt, endsAt, options, votes } = state.poll;
        return { id, question, status, startedAt, endsAt, options: options.map((label, index) => ({ label, votes: counts[index] })), totalVotes: Object.keys(votes).length };
      })()
    : null;
  const giveaway = state.giveaway
    ? (() => {
        const { entrants, ...rest } = state.giveaway;
        return { ...rest, entries: entrants.length, recent: entrants.slice(-30).reverse() };
      })()
    : null;
  return { poll, giveaway, queue: state.queue, highlight: state.highlight, wheel: state.wheel ?? null };
}

class LiveTools {
  private cache = new Map<string, State>();
  private queues = new Map<string, Promise<unknown>>();
  private pushTimers = new Map<string, NodeJS.Timeout>();
  private pollTimers = new Map<string, NodeJS.Timeout>();
  private dirty = new Set<string>();

  async get(userId: string): Promise<State> {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }
    const [row] = await getDb().select({ state: liveTools.state }).from(liveTools).where(eq(liveTools.userId, userId)).limit(1);
    const state = { ...emptyState(), ...((row?.state ?? {}) as Partial<State>) };
    pruneLiveTools(state);
    this.cache.set(userId, state);
    this.schedulePollEnd(userId, state);
    return state;
  }

  /**
   * Retention job: deletes YouTube data older than 30 days from the stored state (with `all`,
   * every YouTube part). Returns whether it changed.
   */
  purgeYouTube(userId: string, all = false) {
    return this.serial(userId, async () => {
      const [row] = await getDb().select({ state: liveTools.state }).from(liveTools).where(eq(liveTools.userId, userId)).limit(1);
      const stored = { ...emptyState(), ...((row?.state ?? {}) as Partial<State>) };
      const cached = this.cache.get(userId);
      const now = Date.now();
      const storedChanged = pruneLiveTools(stored, now, all);
      const cachedChanged = cached ? pruneLiveTools(cached, now, all) : false;
      if (!storedChanged && !cachedChanged) {
        return false;
      }
      if (!cached) {
        this.cache.set(userId, stored);
      }
      this.changed(userId, true);
      return true;
    });
  }

  async snapshot(userId: string) {
    const state = await this.get(userId);
    pruneLiveTools(state);
    return publicTools(state);
  }

  /** Chat on any platform: votes, giveaway entries and queue joins. */
  onEvent(userId: string, event: SignalKitEvent) {
    if (event.kind !== "chat.message" || !event.message || !event.actor) {
      return;
    }
    const message = event.message;
    const actor = event.actor;
    void this.serial(userId, async () => {
      const state = await this.get(userId);
      const person: Participant = { key: `${event.platform}:${actor.id ?? actor.login ?? actor.name}`, name: actor.name || "Someone", platform: event.platform, avatarUrl: actor.avatarUrl ?? null };
      let changed = false;
      if (state.poll?.status === "open") {
        const vote = parseVote(message, state.poll.options);
        if (vote !== null && state.poll.votes[person.key] !== vote) {
          state.poll.votes[person.key] = vote;
          changed = true;
        }
      }
      const text = message.trim().toLowerCase();
      const giveaway = state.giveaway;
      if (giveaway?.status === "open" && text.split(/\s+/)[0] === giveaway.keyword.toLowerCase() && giveaway.entrants.length < MAX_ENTRANTS) {
        if (!giveaway.entrants.some((entrant) => entrant.key === person.key)) {
          giveaway.entrants.push(person);
          changed = true;
        }
      }
      if (state.queue.open && (text === "!join" || text.startsWith("!join "))) {
        const queued = state.queue.entries.some((entry) => entry.key === person.key) || state.queue.current?.key === person.key;
        if (!queued && state.queue.entries.length < MAX_QUEUE) {
          state.queue.entries.push({ ...person, at: new Date().toISOString() });
          changed = true;
        }
      }
      if (text === "!leave") {
        const before = state.queue.entries.length;
        state.queue.entries = state.queue.entries.filter((entry) => entry.key !== person.key);
        changed ||= state.queue.entries.length !== before;
      }
      if (changed) {
        this.changed(userId);
      }
    }).catch((error) => console.error("[live] chat failed", error));
  }

  /** Dashboard actions. Returns the new public state, or an error message. */
  act(userId: string, action: string, input: Record<string, unknown>) {
    return this.serial(userId, async (): Promise<{ tools: PublicLiveTools } | { error: string }> => {
      const state = await this.get(userId);
      const now = new Date().toISOString();
      switch (action) {
        case "poll.start": {
          const question = String(input.question ?? "").trim().slice(0, 140);
          const options = (Array.isArray(input.options) ? input.options : [])
            .map((option) => String(option ?? "").trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 6);
          if (!question || options.length < 2) {
            return { error: "A poll needs a question and at least two options." };
          }
          const seconds = Number(input.durationSec ?? 0);
          state.poll = {
            id: randomUUID(),
            question,
            options,
            votes: {},
            status: "open",
            startedAt: now,
            endsAt: seconds > 0 ? new Date(Date.now() + Math.min(seconds, 3600) * 1000).toISOString() : null,
          };
          this.schedulePollEnd(userId, state);
          break;
        }
        case "poll.end":
          if (state.poll) {
            state.poll.status = "closed";
            state.poll.endsAt = now;
          }
          break;
        case "poll.clear":
          state.poll = null;
          break;
        case "giveaway.start": {
          const keyword = String(input.keyword ?? "!enter").trim().split(/\s+/)[0].slice(0, 30) || "!enter";
          state.giveaway = { id: randomUUID(), title: String(input.title ?? "").trim().slice(0, 100) || "Giveaway", keyword, status: "open", entrants: [], winners: [], startedAt: now };
          break;
        }
        case "giveaway.close":
          if (state.giveaway) {
            state.giveaway.status = "closed";
          }
          break;
        case "giveaway.reopen":
          if (state.giveaway) {
            state.giveaway.status = "open";
          }
          break;
        case "giveaway.draw": {
          const giveaway = state.giveaway;
          if (!giveaway) {
            return { error: "Start a giveaway first." };
          }
          const pool = giveaway.entrants.filter((entrant) => !giveaway.winners.some((winner) => winner.key === entrant.key));
          if (pool.length === 0) {
            return { error: "No entrants left to draw." };
          }
          giveaway.status = "closed";
          giveaway.winners.push({ ...pool[randomInt(pool.length)], at: now });
          break;
        }
        case "giveaway.clear":
          state.giveaway = null;
          break;
        case "queue.open":
          state.queue.open = true;
          if (typeof input.title === "string" && input.title.trim()) {
            state.queue.title = input.title.trim().slice(0, 80);
          }
          break;
        case "queue.close":
          state.queue.open = false;
          break;
        case "queue.next":
          state.queue.current = state.queue.entries.shift() ?? null;
          break;
        case "queue.remove":
          state.queue.entries = state.queue.entries.filter((entry) => entry.key !== input.key);
          if (state.queue.current?.key === input.key) {
            state.queue.current = null;
          }
          break;
        case "queue.clear":
          state.queue = { ...state.queue, entries: [], current: null };
          break;
        case "highlight.pin": {
          const event = input.event as SignalKitEvent | undefined;
          if (!event?.message) {
            return { error: "That message isn't available any more." };
          }
          state.highlight = {
            id: event.id,
            platform: event.platform,
            name: event.actor?.name ?? "Someone",
            avatarUrl: event.actor?.avatarUrl ?? null,
            color: typeof event.data?.color === "string" ? event.data.color : null,
            badges: event.actor?.badges ?? [],
            message: event.message,
            messageParts: event.messageParts,
            at: now,
          };
          break;
        }
        case "highlight.clear":
          state.highlight = null;
          break;
        case "wheel.spin":
          state.wheel = { id: randomUUID(), seed: randomInt(1, 2 ** 31), at: now };
          break;
        default:
          return { error: "Unknown action." };
      }
      this.changed(userId, true);
      return { tools: publicTools(state) };
    });
  }

  private schedulePollEnd(userId: string, state: State) {
    clearTimeout(this.pollTimers.get(userId));
    const poll = state.poll;
    if (poll?.status !== "open" || !poll.endsAt) {
      return;
    }
    const pollId = poll.id;
    this.pollTimers.set(
      userId,
      setTimeout(
        () =>
          void this.serial(userId, async () => {
            const current = await this.get(userId);
            if (current.poll?.id === pollId && current.poll.status === "open") {
              current.poll.status = "closed";
              this.changed(userId, true);
            }
          }),
        Math.max(0, Date.parse(poll.endsAt) - Date.now()),
      ),
    );
  }

  /** Saves and pushes to overlays: right away for dashboard actions, batched for chat. */
  private changed(userId: string, now = false) {
    this.dirty.add(userId);
    if (this.pushTimers.has(userId) && !now) {
      return;
    }
    clearTimeout(this.pushTimers.get(userId));
    this.pushTimers.set(
      userId,
      setTimeout(() => {
        this.pushTimers.delete(userId);
        void this.flush(userId);
      }, now ? 0 : 300),
    );
  }

  private async flush(userId: string) {
    if (!this.dirty.delete(userId)) {
      return;
    }
    const state = await this.get(userId);
    relayHub.publish(userId, { type: "signal_kit.overlay.live_tools", tools: publicTools(state) }, { overlaysOnly: true });
    await getDb()
      .insert(liveTools)
      .values({ userId, state: state as unknown as Record<string, unknown> })
      .onDuplicateKeyUpdate({ set: { state: state as unknown as Record<string, unknown> } })
      .catch((error) => console.error("[live] save failed", error));
  }

  private serial<T>(userId: string, job: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(userId) ?? Promise.resolve()).catch(() => {}).then(job);
    this.queues.set(userId, next);
    void next.finally(() => {
      if (this.queues.get(userId) === next) {
        this.queues.delete(userId);
      }
    });
    return next;
  }
}

const globalForLive = globalThis as typeof globalThis & { __signalKitLive?: LiveTools };
export const liveToolsHub = globalForLive.__signalKitLive ?? new LiveTools();
globalForLive.__signalKitLive = liveToolsHub;
