# Signal Kit

Twitch EventSub as one clean WebSocket for overlays, AI agents, and custom stream tools.

## What It Does

- Manual Twitch OAuth with broad read scopes.
- Encrypted Twitch token storage in MySQL/PlanetScale via Drizzle.
- Background Twitch EventSub WebSocket manager.
- Public overlay WebSocket at `/ws?token=sk_live_...`.
- Dashboard for generating/revoking overlay tokens and syncing desired EventSub subscriptions.
- Tiny browser SDK at `/twe-client.js` and TypeScript SDK source in `src/lib/sdk/client.ts`.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Create a Twitch app callback URL: `http://localhost:3000/api/auth/twitch/callback`.
3. Run `npm run db:generate`.
4. Run `npm run db:migrate`.
5. Run `npm run dev`.

## Docker

1. Copy `.env.example` to `.env` and fill in the values.
2. Set `NEXT_PUBLIC_APP_URL` to the public HTTP(S) URL users will visit.
3. Add the matching Twitch callback URL: `${NEXT_PUBLIC_APP_URL}/api/auth/twitch/callback`.
4. Run migrations with `docker compose --profile tools run --rm migrate`.
5. Start the app with `docker compose up --build app`.

The app container exposes port `3000` and serves both Next.js HTTP routes and the `/ws?token=...` WebSocket relay. For production, put a TLS reverse proxy in front of it and make sure WebSocket upgrades are forwarded.

If you want to use a different env file, run Compose with `SIGNAL_KIT_ENV_FILE=/path/to/env docker compose up --build app`.

## Scripts

- `npm run dev` runs the custom Next + WebSocket server with watch mode.
- `npm run build` builds the Next app.
- `npm run start` runs the custom server in production mode.
- `npm run db:generate` creates Drizzle migrations.
- `npm run db:migrate` applies migrations.

## Overlay Example

```html
<script src="https://your-domain.com/twe-client.js"></script>
<script>
  const events = new SignalKitClient({
    url: "wss://your-domain.com/ws",
    token: "sk_live_...",
  });

  events.on("channel.cheer", ({ event }) => {
    console.log(`${event.user_name} cheered ${event.bits} bits`);
  });

  events.connect();
</script>
```
