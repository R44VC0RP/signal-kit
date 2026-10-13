import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Signal Kit" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Signal Kit (&quot;we&quot;, &quot;us&quot;) lets live streamers connect their Twitch, YouTube and X accounts and receive their
        stream events (chat messages, follows, subscriptions, tips and similar) in their own overlays, bots and tools. This policy
        explains what we collect, how we use it, and how you can remove it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> from the platform you sign in with or connect: your platform user or channel ID, display
          name, username, profile image and email address.
        </li>
        <li>
          <strong>Access tokens</strong> issued by Twitch, Google (YouTube) or X when you connect an account. They are encrypted at
          rest and never sent to your browser, overlays or apps.
        </li>
        <li>
          <strong>Stream events</strong>{" "}from your own channels while you are connected, such as live chat messages and the names of
          viewers who follow, subscribe, tip or raid. These come from the platforms&apos; APIs.
        </li>
        <li>
          <strong>API keys</strong> you create. We store only a hash of each key, plus its name and when it was last used.
        </li>
        <li>
          <strong>Session data</strong>: a sign-in cookie, and the IP address and browser user agent of your sessions, used for
          security.
        </li>
      </ul>

      <h2>YouTube data</h2>
      <p>
        If you connect a YouTube channel, Signal Kit uses YouTube API Services. By connecting YouTube you agree to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and Google&apos;s handling of your data is described in
        the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
      </p>
      <ul>
        <li>
          We request read-only access. We read your channel&apos;s identity, your active live broadcasts, and your live chat (messages, Super Chats,
          Super Stickers and memberships) so we can deliver them to your own tools. We never post, edit or delete anything on your YouTube channel.
        </li>
        <li>
          You can revoke Signal Kit&apos;s access to your Google account at any time at{" "}
          <a href="https://security.google.com/settings/security/permissions">Google security settings</a>, or by disconnecting
          YouTube in the Signal Kit dashboard.
        </li>
      </ul>

      <h2>X data</h2>
      <ul>
        <li>
          If you connect an X account, we read your live broadcasts and their chat, and the new followers and subscribers of that
          account, so we can deliver them to your own tools. We never post, send chat messages or change anything on your X account.
        </li>
        <li>
          You can revoke Signal Kit&apos;s access at any time in X under{" "}
          <a href="https://x.com/settings/connected_apps">Settings › Connected apps</a>, or by disconnecting X in the Signal Kit dashboard.
        </li>
      </ul>

      <h2>How we use your data</h2>
      <ul>
        <li>To sign you in and keep your connected accounts working.</li>
        <li>To deliver your stream events, in real time, only to clients that hold one of your API keys or to your own dashboard.</li>
        <li>To perform actions on your own channels that you request, such as updating a stream title.</li>
        <li>
          To show you stream statistics (viewers, chatters, follows, subs and support per stream) and, if you turn them on, to post
          go-live and recap messages to your Discord through a webhook you provide, and to publish a public stats page at an address you
          choose.
        </li>
        <li>To keep the service secure and to diagnose problems.</li>
      </ul>
      <p>
        We do not sell your data, use it for advertising, or share it with third parties except the infrastructure providers that run
        Signal Kit (hosting and database), who process it only on our behalf, or when required by law.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Stream events are kept for 24 hours so your apps can catch up after a reconnect, then deleted automatically.</li>
        <li>
          Stream history (per-stream totals, and which chatters took part) is kept until you delete your account, except YouTube viewer
          names and pictures, which are removed after 30 days; the totals stay. Public stats pages never show YouTube viewer names.
        </li>
        <li>Your Discord webhook URL is stored encrypted and deleted when you remove it.</li>
        <li>Access tokens are kept while an account is connected and deleted when you disconnect it.</li>
        <li>Account details and API key records are kept until you delete your account.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Disconnect an account</strong> in the dashboard. We revoke the platform access and delete its stored tokens
          immediately.
        </li>
        <li>
          <strong>Revoke an API key</strong> in the dashboard. Anything using it is disconnected immediately.
        </li>
        <li>
          <strong>Delete your account and data</strong> by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We delete
          it within 30 days.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Platform tokens are encrypted, API keys are hashed, and connections use HTTPS. No system is perfectly secure, but we limit
        what we store to what the service needs.
      </p>

      <h2>Children</h2>
      <p>Signal Kit is not directed at children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>
        We will post changes to this policy on this page and update the date above. Questions:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
