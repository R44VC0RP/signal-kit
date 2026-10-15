import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Signal Kit" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms cover your use of Signal Kit, a service that delivers live stream events from Twitch, YouTube and X to your own
        overlays, bots and tools. By using Signal Kit you agree to them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with a Twitch, Google (YouTube) or X account and are responsible for activity under your Signal Kit account.</li>
        <li>Only connect channels and accounts you own or are authorized to manage.</li>
        <li>Keep your API keys secret. Anyone with a key can receive your events; revoke a key if it leaks.</li>
      </ul>

      <h2>Platform terms</h2>
      <p>
        Signal Kit uses the Twitch, YouTube and X APIs. Your use of those platforms remains subject to their terms, including the{" "}
        <a href="https://www.twitch.tv/p/legal/terms-of-service/">Twitch Terms of Service</a>, the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a> and the{" "}
        <a href="https://x.com/en/tos">X Terms of Service</a>. Signal Kit uses YouTube API Services: by connecting a YouTube channel
        or using Signal Kit&apos;s YouTube features, you agree to be bound by the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t use Signal Kit to spam, harass, or impersonate others, or to break any platform&apos;s rules.</li>
        <li>Don&apos;t try to access other users&apos; data, overload the service, or work around its limits.</li>
        <li>Don&apos;t resell or redistribute other people&apos;s data received through Signal Kit.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You keep ownership of your content. We handle personal data as described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>The service</h2>
      <p>
        Signal Kit is provided &quot;as is&quot;, without warranties. Platform APIs change and can be unavailable, so events may be delayed
        or missed. We may change or discontinue features, and may suspend accounts that break these terms.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential damages, or for lost revenue or data, arising
        from your use of Signal Kit.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Signal Kit at any time, disconnect your accounts in the dashboard, and ask us to delete your data at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We will post changes on this page and update the date above. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
