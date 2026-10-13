import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { botConfigs, connections, type Platform } from "@/db/schema";
import { newEventId } from "@/lib/events/ids";
import type { SignalKitEvent } from "@/lib/events/types";
import { streamTracker } from "@/lib/streams/tracker";
import { relayHub } from "@/lib/ws/relay";
import { atLeast, defaultBotConfig, roleOf, sanitizeBotConfig, spamReason, type BotConfig, type Builtin, type Role } from "./config";
import { addPoints, pointsOf, spendPoints, topPoints } from "./loyalty";
import { chatters, createClip, createMarker, deleteMessage, followedAt, lastGame, sendChat, shoutout, timeoutUser, userByLogin } from "./twitch";

/**
 * The chat bot. Reads chat from every platform (loyalty points count everywhere) and acts on
 * Twitch: commands, timed messages, spam filters, the points store and stream markers. Replies
 * go out at most one every 1.2 s per channel, and the bot never answers its own messages.
 */

type Channel = { broadcasterId: string; connectionId: string; sender: { id: string; connectionId: string } };

const SEND_GAP_MS = 1200;
const MAX_QUEUE = 10;
const BUILTIN_COOLDOWN_MS = 5000;
const SHARED_COOLDOWN_MS = 5000;
const PERSONAL_BUILTINS = new Set<Builtin>(["points", "redeem", "followage"]);

class ChatBot {
  private configs = new Map<string, BotConfig>();
  private channels = new Map<string, Channel | null>();
  private cooldowns = new Map<string, number>();
  private timerState = new Map<string, { last: number; lines: number }>();
  private recentSent = new Map<string, { text: string; at: number }[]>();
  private queues = new Map<string, { chain: Promise<void>; size: number }>();
  private dirtyUses = new Set<string>();
  private started = false;

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.loadAll();
    setInterval(() => void this.runTimers(), 30_000);
    setInterval(() => void this.awardWatchTime(), 5 * 60_000);
    setInterval(() => void this.persistUses(), 60_000);
  }

  async config(userId: string) {
    if (!this.configs.has(userId)) {
      const [row] = await getDb().select({ config: botConfigs.config }).from(botConfigs).where(eq(botConfigs.userId, userId)).limit(1);
      this.configs.set(userId, row ? sanitizeBotConfig(row.config) : defaultBotConfig());
    }
    return this.configs.get(userId)!;
  }

  async save(userId: string, input: unknown) {
    const config = sanitizeBotConfig(input);
    await getDb()
      .insert(botConfigs)
      .values({ userId, config: config as unknown as Record<string, unknown> })
      .onDuplicateKeyUpdate({ set: { config: config as unknown as Record<string, unknown> } });
    this.configs.set(userId, config);
    this.channels.delete(userId);
    return config;
  }

  private async loadAll() {
    try {
      const rows = await getDb().select().from(botConfigs);
      for (const row of rows) {
        this.configs.set(row.userId, sanitizeBotConfig(row.config));
      }
    } catch (error) {
      console.error("[bot] load failed", error);
    }
  }

  /** The Twitch channel and the account that speaks for the bot. */
  private async channel(userId: string, config: BotConfig): Promise<Channel | null> {
    if (this.channels.has(userId)) {
      return this.channels.get(userId)!;
    }
    const rows = await getDb()
      .select()
      .from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.platform, "twitch"), eq(connections.status, "active")));
    const broadcaster = rows.find((row) => row.role !== "bot");
    const bot = config.sender !== "broadcaster" ? rows.find((row) => row.id === config.sender && row.role === "bot") : undefined;
    const channel = broadcaster
      ? { broadcasterId: broadcaster.platformUserId, connectionId: broadcaster.id, sender: bot ? { id: bot.platformUserId, connectionId: bot.id } : { id: broadcaster.platformUserId, connectionId: broadcaster.id } }
      : null;
    this.channels.set(userId, channel);
    return channel;
  }

  /** Every ingested event. */
  onEvent(userId: string, event: SignalKitEvent) {
    void this.handle(userId, event).catch((error) => console.error("[bot] event failed", error));
  }

  private async handle(userId: string, event: SignalKitEvent) {
    const config = this.configs.get(userId);
    if (!config?.enabled) {
      return;
    }
    if (event.kind === "chat.message") {
      await this.onChat(userId, config, event);
      return;
    }
    await this.onSupport(userId, config, event);
  }

  private async onChat(userId: string, config: BotConfig, event: SignalKitEvent) {
    const actor = event.actor;
    const message = event.message?.trim() ?? "";
    if (!actor || !message) {
      return;
    }
    const platform = event.platform as Platform;
    const channel = platform === "twitch" ? await this.channel(userId, config) : null;
    // Never react to the bot's own messages.
    if (channel && actor.id === channel.sender.id && (channel.sender.id !== channel.broadcasterId || this.isEcho(userId, message))) {
      return;
    }
    const role = roleOf(actor.badges);

    if (channel && config.moderation.enabled && !atLeast(role, config.moderation.exempt)) {
      const emotes = (event.messageParts ?? []).filter((part) => part.type === "emote").length;
      const reason = spamReason(message, emotes, config.moderation);
      if (reason) {
        await this.moderate(userId, config, channel, event, reason);
        return;
      }
    }

    if (config.loyalty.enabled && config.loyalty.perMessage > 0 && actor.id) {
      const key = `${userId}:pts:${platform}:${actor.id}`;
      if (this.ready(key, config.loyalty.messageCooldownSec * 1000)) {
        await addPoints(userId, [{ platform, chatterId: actor.id, name: actor.name, points: config.loyalty.perMessage }]);
      }
    }

    for (const timer of config.timers) {
      const state = this.timerState.get(`${userId}:${timer.id}`);
      if (state) {
        state.lines += 1;
      }
    }

    if (channel && message.startsWith("!")) {
      await this.command(userId, config, channel, event, role);
    }
  }

  private async moderate(userId: string, config: BotConfig, channel: Channel, event: SignalKitEvent, reason: string) {
    const name = event.actor?.name ?? "";
    try {
      if (config.moderation.action === "timeout" && event.actor?.id) {
        await timeoutUser(channel.connectionId, channel.broadcasterId, event.actor.id, config.moderation.timeoutSec, `Signal Kit filter: ${reason}`);
      } else if (typeof event.data?.messageId === "string") {
        await deleteMessage(channel.connectionId, channel.broadcasterId, event.data.messageId);
      }
    } catch (error) {
      console.warn(`[bot] moderation failed (${reason}): ${(error as Error).message}`);
      return;
    }
    if (config.moderation.warn && this.ready(`${userId}:warn:${event.actor?.id}`, 30_000)) {
      const why = { links: "no links please", caps: "please ease up on the caps", symbols: "please ease up on the symbols", emotes: "too many emotes", length: "that message was too long", words: "that word isn't allowed here" }[reason] ?? "please follow the chat rules";
      this.say(userId, channel, `@${name}, ${why}.`);
    }
  }

  // ---- Commands -----------------------------------------------------------------------------

  private async command(userId: string, config: BotConfig, channel: Channel, event: SignalKitEvent, role: Role) {
    const message = event.message!.trim();
    const [rawName, ...args] = message.slice(1).split(/\s+/);
    const name = rawName.toLowerCase();
    const actor = event.actor!;
    const target = (args[0] ?? "").replace(/^@/, "") || actor.name;
    const reply = (text: string) => this.say(userId, channel, text);

    const custom = config.commands.find((command) => command.enabled && command.name === name);
    if (custom) {
      if (!atLeast(role, custom.permission) || !this.ready(`${userId}:cmd:${name}`, custom.cooldownSec * 1000) || !this.ready(`${userId}:cmd:${name}:${actor.id}`, custom.userCooldownSec * 1000)) {
        return;
      }
      custom.uses += 1;
      this.dirtyUses.add(userId);
      reply(await this.fill(userId, config, custom.response, { user: actor.name, target, args: args.join(" "), count: custom.uses, actorId: actor.id ?? "" }));
      return;
    }

    // Per-viewer cooldown so one person can't spam; commands whose answer is the same for
    // everyone (uptime, top, commands…) also get a shared one so a flood gets one reply.
    const builtin = (key: Builtin, need: Role = "everyone") =>
      config.builtins[key] &&
      atLeast(role, need) &&
      this.ready(`${userId}:builtin:${key}:${actor.id}`, BUILTIN_COOLDOWN_MS) &&
      (PERSONAL_BUILTINS.has(key) || this.ready(`${userId}:builtin:${key}`, SHARED_COOLDOWN_MS));
    const pointsName = config.loyalty.name;

    switch (name) {
      case "uptime":
        if (builtin("uptime")) {
          const snapshot = streamTracker.snapshot(userId);
          reply(snapshot.live && snapshot.startedAt ? `Live for ${duration(Date.now() - Date.parse(snapshot.startedAt))}.` : "The stream is offline.");
        }
        return;
      case "followage":
        if (builtin("followage")) {
          const user = args[0] ? await userByLogin(target).catch(() => null) : { id: actor.id ?? "", display_name: actor.name };
          const since = user?.id ? await followedAt(channel.connectionId, channel.broadcasterId, user.id).catch(() => null) : null;
          reply(since ? `${user!.display_name} has followed for ${duration(Date.now() - Date.parse(since), true)}.` : `${user?.display_name ?? target} isn't following yet.`);
        }
        return;
      case "points":
        if (builtin("points") && config.loyalty.enabled && actor.id) {
          const who = args[0] ? await userByLogin(target).catch(() => null) : { id: actor.id, display_name: actor.name };
          if (who) {
            const { points, rank } = await pointsOf(userId, "twitch", who.id);
            reply(`${who.display_name} has ${points.toLocaleString("en")} ${pointsName} (#${rank}).`);
          }
        }
        return;
      case "top":
      case "leaderboard":
        if (builtin("top") && config.loyalty.enabled) {
          const top = await topPoints(userId, 5);
          reply(top.length ? `Top ${pointsName}: ${top.map((row, index) => `${index + 1}. ${row.name} (${row.points.toLocaleString("en")})`).join(" · ")}` : `No ${pointsName} yet.`);
        }
        return;
      case "redeem":
        if (builtin("redeem") && config.loyalty.enabled && actor.id) {
          await this.redeem(userId, config, channel, event, args.join(" "));
        }
        return;
      case "so":
      case "shoutout":
        if (builtin("shoutout", "moderator") && args[0]) {
          const user = await userByLogin(target).catch(() => null);
          if (!user) {
            reply(`Couldn't find ${target}.`);
            return;
          }
          const info = await lastGame(user.id).catch(() => null);
          reply(`Go check out ${user.display_name}${info?.game_name ? `, last seen playing ${info.game_name}` : ""}: https://twitch.tv/${user.login}`);
          await shoutout(channel.connectionId, channel.broadcasterId, user.id).catch(() => {});
        }
        return;
      case "clip":
        if (builtin("clip", config.clipPermission)) {
          const url = await createClip(channel.connectionId, channel.broadcasterId).catch(() => null);
          reply(url ? `Clipped! ${url}` : "Couldn't make a clip (the stream needs to be live).");
        }
        return;
      case "marker":
        if (builtin("marker", "moderator")) {
          const ok = await createMarker(channel.connectionId, channel.broadcasterId, args.join(" ") || `Marked by ${actor.name}`)
            .then(() => true)
            .catch(() => false);
          reply(ok ? "Stream marker added." : "Couldn't add a marker (the stream needs to be live).");
        }
        return;
      case "quote":
        if (builtin("quote") && config.quotes.length) {
          const quote = args[0] && /^\d+$/.test(args[0]) ? config.quotes.find((q) => q.id === Number(args[0])) : config.quotes[Math.floor(Math.random() * config.quotes.length)];
          reply(quote ? `#${quote.id}: "${quote.text}"${quote.by ? ` (${quote.by})` : ""}` : "No quote with that number.");
        }
        return;
      case "addquote":
        if (config.builtins.quote && atLeast(role, "moderator") && args.length) {
          const next = { id: Math.max(0, ...config.quotes.map((q) => q.id)) + 1, text: args.join(" ").slice(0, 300), by: actor.name, at: new Date().toISOString() };
          await this.save(userId, { ...config, quotes: [...config.quotes, next] });
          reply(`Added quote #${next.id}.`);
        }
        return;
      case "delquote":
        if (config.builtins.quote && atLeast(role, "moderator") && /^\d+$/.test(args[0] ?? "")) {
          await this.save(userId, { ...config, quotes: config.quotes.filter((q) => q.id !== Number(args[0])) });
          reply(`Removed quote #${args[0]}.`);
        }
        return;
      case "commands":
        if (builtin("commands")) {
          const names = [...config.commands.filter((c) => c.enabled && c.permission === "everyone").map((c) => `!${c.name}`), ...(["uptime", "followage", "points", "top", "redeem", "quote"] as Builtin[]).filter((key) => config.builtins[key]).map((key) => `!${key}`)];
          reply(`Commands: ${names.join(" ")}`);
        }
        return;
    }
  }

  private async redeem(userId: string, config: BotConfig, channel: Channel, event: SignalKitEvent, query: string) {
    const actor = event.actor!;
    const items = config.loyalty.store.filter((item) => item.enabled);
    const wanted = query.trim().toLowerCase();
    if (!wanted) {
      this.say(userId, channel, items.length ? `Store: ${items.map((item) => `${item.name} (${item.cost.toLocaleString("en")})`).join(" · ")}. Type !redeem <name>.` : "The store is empty.");
      return;
    }
    const item = items.find((entry) => entry.name.toLowerCase() === wanted) ?? items.find((entry) => entry.name.toLowerCase().startsWith(wanted));
    if (!item) {
      this.say(userId, channel, `@${actor.name}, there's no "${query}" in the store. Type !redeem to see it.`);
      return;
    }
    if (!(await spendPoints(userId, "twitch", actor.id!, item.cost))) {
      const { points } = await pointsOf(userId, "twitch", actor.id!);
      this.say(userId, channel, `@${actor.name}, ${item.name} costs ${item.cost.toLocaleString("en")} ${config.loyalty.name}; you have ${points.toLocaleString("en")}.`);
      return;
    }
    this.say(userId, channel, `${actor.name} redeemed ${item.name} for ${item.cost.toLocaleString("en")} ${config.loyalty.name}!`);
    // Overlays treat it like a channel point redemption: the alert box shows it; a wheel set to this reward spins.
    const now = new Date().toISOString();
    const redemption: SignalKitEvent = {
      v: 2,
      id: newEventId(),
      kind: "redemption",
      platform: "twitch",
      channel: { connectionId: channel.connectionId, id: channel.broadcasterId, name: "" },
      actor: { id: actor.id, name: actor.name, login: actor.login },
      message: null,
      amount: null,
      data: { reward: { title: item.name, cost: item.cost }, source: "loyalty" },
      occurredAt: now,
      receivedAt: now,
      raw: { type: "signal_kit.loyalty.redeem", event: {} },
      type: "signal_kit.loyalty.redeem",
      provider: "twitch",
      event: {},
    };
    relayHub.publish(userId, redemption, { overlaysOnly: true });
  }

  /** Bonus points for support, and stream markers on big moments. */
  private async onSupport(userId: string, config: BotConfig, event: SignalKitEvent) {
    const actor = event.actor;
    const data = event.data ?? {};
    const platform = event.platform as Platform;
    if (config.loyalty.enabled && actor?.id) {
      const bonus =
        event.kind === "follow"
          ? config.loyalty.bonusFollow
          : event.kind === "subscription"
            ? config.loyalty.bonusSub
            : event.kind === "subscription.gift"
              ? config.loyalty.bonusSub * (typeof data.count === "number" ? data.count : 1)
              : event.kind === "tip" && event.amount?.currency === "BITS"
                ? Math.floor(event.amount.value / 100) * config.loyalty.bonusCheer
                : event.kind === "raid"
                  ? config.loyalty.bonusRaid
                  : 0;
      if (bonus > 0) {
        await addPoints(userId, [{ platform, chatterId: actor.id, name: actor.name, points: bonus }]);
      }
    }
    if (config.markers.enabled && platform === "twitch") {
      const note =
        event.kind === "raid" && config.markers.raid
          ? `Raid from ${actor?.name ?? "someone"} (${Number(data.viewers ?? 0)} viewers)`
          : event.kind === "hype_train" && config.markers.hypeTrain && data.phase === "begin"
            ? "Hype train started"
            : event.kind === "subscription.gift" && config.markers.giftMin > 0 && Number(data.count ?? 1) >= config.markers.giftMin
              ? `${actor?.name ?? "Someone"} gifted ${Number(data.count)} subs`
              : event.kind === "tip" && event.amount?.currency === "BITS" && config.markers.cheerMin > 0 && event.amount.value >= config.markers.cheerMin
                ? `${actor?.name ?? "Someone"} cheered ${event.amount.value} bits`
                : null;
      const channel = note ? await this.channel(userId, config) : null;
      if (note && channel) {
        await createMarker(channel.connectionId, channel.broadcasterId, note).catch(() => {});
      }
    }
  }

  // ---- Timers and watch time ----------------------------------------------------------------

  private async runTimers() {
    for (const [userId, config] of this.configs) {
      if (!config.enabled || !streamTracker.snapshot(userId).live) {
        continue;
      }
      const channel = await this.channel(userId, config).catch(() => null);
      if (!channel) {
        continue;
      }
      for (const timer of config.timers.filter((t) => t.enabled)) {
        const key = `${userId}:${timer.id}`;
        const state = this.timerState.get(key);
        if (!state) {
          this.timerState.set(key, { last: Date.now(), lines: 0 });
          continue;
        }
        if (Date.now() - state.last >= timer.intervalMin * 60_000 && state.lines >= timer.minLines) {
          this.say(userId, channel, timer.message);
          this.timerState.set(key, { last: Date.now(), lines: 0 });
        }
      }
    }
  }

  private async awardWatchTime() {
    for (const [userId, config] of this.configs) {
      if (!config.enabled || !config.loyalty.enabled || config.loyalty.perMinute <= 0 || streamTracker.snapshot(userId).viewers.twitch === undefined) {
        continue;
      }
      try {
        const channel = await this.channel(userId, config);
        if (!channel) {
          continue;
        }
        const present = await chatters(channel.connectionId, channel.broadcasterId);
        await addPoints(
          userId,
          present.map((viewer) => ({ platform: "twitch" as const, chatterId: viewer.user_id, name: viewer.user_name, points: config.loyalty.perMinute * 5, minutes: 5 })),
        );
      } catch (error) {
        console.warn(`[bot] watch time for ${userId}: ${(error as Error).message}`);
      }
    }
  }

  private async persistUses() {
    for (const userId of [...this.dirtyUses]) {
      this.dirtyUses.delete(userId);
      const config = this.configs.get(userId);
      if (config) {
        await this.save(userId, config).catch(() => {});
      }
    }
  }

  // ---- Helpers ------------------------------------------------------------------------------

  /** Queues a chat message; spaced out, and dropped if the queue is backed up. */
  private say(userId: string, channel: Channel, text: string) {
    const message = text.trim();
    if (!message) {
      return;
    }
    const queue = this.queues.get(userId) ?? { chain: Promise.resolve(), size: 0 };
    if (queue.size >= MAX_QUEUE) {
      return;
    }
    queue.size += 1;
    queue.chain = queue.chain
      .then(async () => {
        const sent = this.recentSent.get(userId) ?? [];
        sent.push({ text: message.slice(0, 500), at: Date.now() });
        this.recentSent.set(userId, sent.filter((entry) => Date.now() - entry.at < 20_000).slice(-20));
        await sendChat(channel.broadcasterId, channel.sender, message);
      })
      .catch((error) => console.warn(`[bot] send failed: ${(error as Error).message}`))
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, SEND_GAP_MS)))
      .finally(() => {
        queue.size -= 1;
      });
    this.queues.set(userId, queue);
  }

  private isEcho(userId: string, text: string) {
    return (this.recentSent.get(userId) ?? []).some((entry) => entry.text === text && Date.now() - entry.at < 20_000);
  }

  /** True (and starts the cooldown) when `key` isn't cooling down. */
  private ready(key: string, cooldownMs: number) {
    if (cooldownMs <= 0) {
      return true;
    }
    const until = this.cooldowns.get(key) ?? 0;
    if (Date.now() < until) {
      return false;
    }
    this.cooldowns.set(key, Date.now() + cooldownMs);
    if (this.cooldowns.size > 20_000) {
      for (const [entry, expires] of this.cooldowns) {
        if (expires < Date.now()) {
          this.cooldowns.delete(entry);
        }
      }
    }
    return true;
  }

  /** Command response variables: {user} {target} {args} {count} {uptime} {points} {pointsname} {random:1-100}. */
  private async fill(userId: string, config: BotConfig, template: string, values: { user: string; target: string; args: string; count: number; actorId: string }) {
    let text = template
      .replace(/\{user\}/gi, values.user)
      .replace(/\{(target|touser)\}/gi, values.target)
      .replace(/\{args\}/gi, values.args)
      .replace(/\{count\}/gi, values.count.toLocaleString("en"))
      .replace(/\{pointsname\}/gi, config.loyalty.name)
      .replace(/\{random:(\d+)-(\d+)\}/gi, (_, a: string, b: string) => {
        const [low, high] = [Number(a), Number(b)].sort((x, y) => x - y);
        return String(low + Math.floor(Math.random() * (high - low + 1)));
      });
    if (/\{uptime\}/i.test(text)) {
      const snapshot = streamTracker.snapshot(userId);
      text = text.replace(/\{uptime\}/gi, snapshot.live && snapshot.startedAt ? duration(Date.now() - Date.parse(snapshot.startedAt)) : "offline");
    }
    if (/\{points\}/i.test(text) && values.actorId) {
      const { points } = await pointsOf(userId, "twitch", values.actorId);
      text = text.replace(/\{points\}/gi, points.toLocaleString("en"));
    }
    return text;
  }
}

/** "1h 23m", or "1 year, 2 months" with `long`. */
function duration(ms: number, long = false) {
  const minutes = Math.floor(ms / 60_000);
  if (!long) {
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  }
  const days = Math.floor(minutes / 1440);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rest = days % 30;
  const parts = [years && `${years} year${years > 1 ? "s" : ""}`, months && `${months} month${months > 1 ? "s" : ""}`, !years && rest && `${rest} day${rest > 1 ? "s" : ""}`].filter(Boolean);
  return parts.length ? parts.join(", ") : "less than a day";
}

const globalForBot = globalThis as typeof globalThis & { __signalKitBot?: ChatBot };
export const chatBot = globalForBot.__signalKitBot ?? new ChatBot();
globalForBot.__signalKitBot = chatBot;
