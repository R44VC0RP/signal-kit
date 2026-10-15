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
        the <a href="http://www.google.com/policies/privacy">Google Privacy Policy</a>.
      </p>
      <ul>
        <li>
          We request read-only access. We read your channel&apos;s identity, your active live broadcasts, and your live chat (messages, Super Chats,
          Super Stickers and memberships) so we can deliver them to your own tools. We never post, edit or delete anything on your YouTube channel.
        </li>
        <li>
          <strong>We delete all data obtained from YouTube API Services within 30 days.</strong> That covers live chat messages, viewers&apos;
          names, channel IDs and profile pictures, Super Chat, Super Sticker and membership details and amounts, concurrent viewer
          counts, broadcast titles, and every statistic we derive from them (per-stream YouTube totals and charts, chatter counts,
          goal and label counts, loyalty points). A deletion job checks every hour, so nothing from YouTube is kept longer than 30
          days and one hour, and YouTube data older than 30 days is never shown, even before that job runs. Stream history keeps only
          non-YouTube data (for example Twitch) beyond 30 days; a stream that was only on YouTube is deleted entirely.
        </li>
        <li>
          Your own connected channel&apos;s name, handle and picture are re-read from YouTube every week while it is connected, and
          cleared if they can&apos;t be refreshed for 30 days. Its channel ID and tokens are kept while YouTube is connected. If access is
          revoked, we delete the tokens and the channel&apos;s profile, and keep only its YouTube channel ID until you reconnect or remove
          it, so the dashboard can offer to reconnect.
        </li>
        <li>
          Because of this, YouTube support counts toward goals and labels for 30 days, &quot;new&quot; and &quot;returning&quot; YouTube
          chatters are judged over the last 30 days, and YouTube viewers&apos; loyalty points are deleted after 30 days without activity.
        </li>
        <li>
          Statistics shown in Signal Kit (stream totals, viewer averages and peaks, chatter counts, goals and loyalty points) are calculated by
          Signal Kit from stream events and are not provided by YouTube.
        </li>
        <li>
          You can revoke Signal Kit&apos;s access to your Google account at any time at{" "}
          <a href="https://security.google.com/settings/security/permissions">https://security.google.com/settings/security/permissions</a>, or
          by disconnecting YouTube in the Signal Kit dashboard. Either way, <strong>we delete all YouTube data Signal Kit stored within 7
          days</strong>: in practice immediately when you disconnect in the dashboard (which also revokes the access with Google and deletes
          its tokens), and within an hour or two after you revoke access at Google (an hourly check renews each YouTube connection&apos;s
          access with Google, which fails once access was revoked, and deletes that user&apos;s YouTube data in the same pass).
        </li>
        <li>
          Deleting Signal Kit&apos;s data doesn&apos;t change or delete anything stored by YouTube; your channel, videos and chat on YouTube
          are unaffected.
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
        <li>
          To perform actions on your own channels that you request, such as updating a stream title, or, if you turn on the Twitch chat
          bot: replying to commands, posting timed messages, deleting spam or timing out users under your filter rules, shoutouts,
          clips and stream markers. Loyalty points store each viewer&apos;s name, platform id, points and watch time on your channel.
        </li>
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
        <li>Raw stream events (all platforms) are kept for 24 hours so your apps can catch up after a reconnect, then deleted automatically.</li>
        <li>
          Everything obtained from YouTube API Services, and statistics derived from it, is deleted within 30 days (checked every hour;
          see YouTube data above).
        </li>
        <li>
          Stream history from other platforms (per-stream totals, and which chatters took part) is kept until you delete your account.
          Public stats pages never show YouTube data.
        </li>
        <li>Your Discord webhook URL is stored encrypted and deleted when you remove it.</li>
        <li>
          Access tokens are kept while an account is connected and deleted when you disconnect it, or for YouTube, once we find its access
          was revoked. Disconnecting YouTube, or revoking Signal Kit&apos;s access at Google, also deletes all YouTube data we stored (see
          YouTube data above).
        </li>
        <li>
          Account details and API key records are kept until you delete your account (a connected YouTube channel&apos;s profile is
          refreshed weekly, as described above).
        </li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Disconnect an account</strong> in the dashboard. We revoke the platform access and delete its stored tokens
          immediately; for YouTube we also delete all YouTube data Signal Kit stored.
        </li>
        <li>
          <strong>Revoke an API key</strong> in the dashboard. Anything using it is disconnected immediately.
        </li>
        <li>
          <strong>Delete your account and data</strong> by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We delete
          it within 7 days of your request.
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
