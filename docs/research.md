# Research Notes

## Twitch EventSub WebSocket

- Twitch EventSub can deliver notifications over WebSocket at `wss://eventsub.wss.twitch.tv/ws`.
- The WebSocket is outgoing-only from Twitch's perspective. Clients should not send messages except Pong frames.
- Twitch sends `session_welcome`, `session_keepalive`, `session_reconnect`, `notification`, and `revocation` messages.
- A new WebSocket must receive at least one subscription within roughly 10 seconds or Twitch closes it with `4003 Connection unused`.
- WebSocket subscriptions are created through `POST /helix/eventsub/subscriptions` with transport `{ method: "websocket", session_id }`.
- WebSocket subscription creation requires a user access token, not an app access token.
- If the WebSocket disconnects, subscriptions attached to that session are disabled and must be recreated on a new session.
- Limits are per client ID + user ID tuple: up to 3 enabled WebSocket connections, up to 300 enabled subscriptions per connection, and `max_total_cost` of 10.

## Product Implication

- A hosted relay is feasible: this app owns the Twitch EventSub WebSocket per authenticated broadcaster and exposes a separate overlay-safe WebSocket to downstream clients.
- Browser overlays should use revocable relay tokens, not Twitch access tokens.
- The app stores Twitch tokens encrypted because the background EventSub manager needs user tokens to refresh and subscribe.
- Some EventSub types require scopes and condition fields where the moderator/user ID must match the token owner for WebSocket transport. The initial catalog assumes broadcaster-as-moderator for those events.

## Open Production Work

- Confirm every cataloged EventSub type/version and scope against Twitch docs before broad public launch.
- Add token encryption key rotation.
- Add multi-instance coordination so only one worker owns a broadcaster's Twitch WebSocket at a time.
- Add durable event logs or replay if product requirements need missed-event recovery. Twitch itself does not replay WebSocket gaps.
