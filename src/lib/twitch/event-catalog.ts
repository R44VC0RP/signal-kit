import { hasScopes } from "./scopes";

export type TwitchEventUser = {
  id: string;
  scopes: string[];
};

export type EventCatalogItem = {
  type: string;
  version: string;
  label: string;
  description: string;
  requiredScopes: string[];
  buildCondition: (user: TwitchEventUser) => Record<string, string>;
};

const broadcaster = (user: TwitchEventUser) => ({ broadcaster_user_id: user.id });
const moderatorIsBroadcaster = (user: TwitchEventUser) => ({
  broadcaster_user_id: user.id,
  moderator_user_id: user.id,
});
const chatUser = (user: TwitchEventUser) => ({ broadcaster_user_id: user.id, user_id: user.id });

export const EVENT_CATALOG: EventCatalogItem[] = [
  event("channel.update", "1", "Channel Update", "Title, category, language, or mature flag changed.", [], broadcaster),
  event("stream.online", "1", "Stream Online", "The channel goes live.", [], broadcaster),
  event("stream.offline", "1", "Stream Offline", "The channel goes offline.", [], broadcaster),
  event("channel.follow", "2", "Follow", "A viewer follows the channel.", ["moderator:read:followers"], moderatorIsBroadcaster),
  event("channel.subscribe", "1", "Subscribe", "A viewer subscribes.", ["channel:read:subscriptions"], broadcaster),
  event("channel.subscription.end", "1", "Subscription End", "A subscription ends.", ["channel:read:subscriptions"], broadcaster),
  event("channel.subscription.gift", "1", "Gift Sub", "A viewer gifts one or more subscriptions.", ["channel:read:subscriptions"], broadcaster),
  event("channel.subscription.message", "1", "Resub Message", "A viewer sends a resubscription message.", ["channel:read:subscriptions"], broadcaster),
  event("channel.cheer", "1", "Cheer", "A viewer cheers Bits.", ["bits:read"], broadcaster),
  event("channel.raid", "1", "Incoming Raid", "Another broadcaster raids this channel.", [], (user) => ({ to_broadcaster_user_id: user.id })),
  event("channel.channel_points_custom_reward_redemption.add", "1", "Reward Redemption Add", "A channel points reward is redeemed.", ["channel:read:redemptions"], broadcaster),
  event("channel.channel_points_custom_reward_redemption.update", "1", "Reward Redemption Update", "A redemption status changes.", ["channel:read:redemptions"], broadcaster),
  event("channel.poll.begin", "1", "Poll Begin", "A poll starts.", ["channel:read:polls"], broadcaster),
  event("channel.poll.progress", "1", "Poll Progress", "A poll receives votes.", ["channel:read:polls"], broadcaster),
  event("channel.poll.end", "1", "Poll End", "A poll ends.", ["channel:read:polls"], broadcaster),
  event("channel.prediction.begin", "1", "Prediction Begin", "A prediction starts.", ["channel:read:predictions"], broadcaster),
  event("channel.prediction.progress", "1", "Prediction Progress", "A prediction receives participation.", ["channel:read:predictions"], broadcaster),
  event("channel.prediction.lock", "1", "Prediction Lock", "A prediction locks.", ["channel:read:predictions"], broadcaster),
  event("channel.prediction.end", "1", "Prediction End", "A prediction resolves.", ["channel:read:predictions"], broadcaster),
  event("channel.hype_train.begin", "2", "Hype Train Begin", "A Hype Train starts.", ["channel:read:hype_train"], broadcaster),
  event("channel.hype_train.progress", "2", "Hype Train Progress", "A Hype Train progresses.", ["channel:read:hype_train"], broadcaster),
  event("channel.hype_train.end", "2", "Hype Train End", "A Hype Train ends.", ["channel:read:hype_train"], broadcaster),
  event("channel.goal.begin", "1", "Goal Begin", "A goal starts.", ["channel:read:goals"], broadcaster),
  event("channel.goal.progress", "1", "Goal Progress", "A goal progresses.", ["channel:read:goals"], broadcaster),
  event("channel.goal.end", "1", "Goal End", "A goal ends.", ["channel:read:goals"], broadcaster),
  event("channel.charity_campaign.start", "1", "Charity Start", "A charity campaign starts.", ["channel:read:charity"], broadcaster),
  event("channel.charity_campaign.progress", "1", "Charity Progress", "A charity campaign progresses.", ["channel:read:charity"], broadcaster),
  event("channel.charity_campaign.stop", "1", "Charity Stop", "A charity campaign stops.", ["channel:read:charity"], broadcaster),
  event("channel.charity_campaign.donate", "1", "Charity Donate", "A viewer donates to charity.", ["channel:read:charity"], broadcaster),
  event("channel.ad_break.begin", "1", "Ad Break Begin", "An ad break starts.", ["channel:read:ads"], broadcaster),
  event("channel.chat.message", "1", "Chat Message", "A chat message is sent.", ["user:read:chat"], chatUser),
  event("channel.chat.notification", "1", "Chat Notification", "A system chat notification appears.", ["user:read:chat"], chatUser),
  event("channel.chat_settings.update", "1", "Chat Settings", "The channel chat settings change.", ["moderator:read:chat_settings"], chatUser),
  event("channel.shoutout.create", "1", "Shoutout Create", "A shoutout is created.", ["moderator:read:shoutouts"], moderatorIsBroadcaster),
  event("channel.shoutout.receive", "1", "Shoutout Receive", "The broadcaster receives a shoutout.", ["moderator:read:shoutouts"], moderatorIsBroadcaster),
];

export function eventCatalogForUser(user: TwitchEventUser) {
  return EVENT_CATALOG.map((item) => ({
    ...item,
    condition: item.buildCondition(user),
    enabledByScopes: hasScopes(user.scopes, item.requiredScopes),
  }));
}

function event(
  type: string,
  version: string,
  label: string,
  description: string,
  requiredScopes: string[],
  buildCondition: EventCatalogItem["buildCondition"],
): EventCatalogItem {
  return { type, version, label, description, requiredScopes, buildCondition };
}
