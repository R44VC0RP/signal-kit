import Link from "next/link";
import { redirect } from "next/navigation";
import { ConnectButton, type ProviderId } from "@/components/AuthButtons";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { enabledProviders } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";

/** Better Auth error codes that reach this page via errorCallbackURL. */
const ERRORS: Record<string, string> = {
  account_not_linked:
    "That account isn't connected to a Signal Kit user yet. Sign in with an account you already connected, then add this one from Connections.",
  account_already_linked_to_different_user: "That account is already connected to a different Signal Kit user.",
  access_denied: "Sign-in was cancelled.",
};

const OPTIONS: { platform: Platform; provider: ProviderId; label: string }[] = [
  { platform: "twitch", provider: "twitch", label: "Continue with Twitch" },
  { platform: "youtube", provider: "google", label: "Continue with YouTube" },
  { platform: "x", provider: "twitter", label: "Continue with X" },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser().catch(() => null)) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;
  const providers = enabledProviders();

  return (
    <main className="sk-app flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-85 flex-col gap-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="sk-grain flex size-10 items-center justify-center rounded-[10px] bg-(--accent-fill)">
            <span className="size-2.75 rounded-full bg-white" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="sk-brand text-[26px] leading-8 font-semibold tracking-[-0.02em] text-(--text)">Sign in to Signal Kit</h1>
            <p className="text-[13px] leading-[19px] text-(--text-3)">Use any account you stream on. You can connect the others afterwards.</p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-(--r) border border-[rgb(255_143_63/35%)] bg-[rgb(255_143_63/12%)] px-3.5 py-3 text-[13px] leading-[19px] text-(--text)">
            {ERRORS[error] ?? `Sign-in failed (${error}).`}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {OPTIONS.filter((option) => providers[option.provider]).map((option) => (
            <ConnectButton key={option.provider} provider={option.provider} mode="signin" wrapperClassName="flex flex-col gap-1" className={`${buttonClass("control", "lg")} w-full`}>
              <span className="flex w-4.5 justify-center">
                <PlatformLogo platform={option.platform} />
              </span>
              {option.label}
            </ConnectButton>
          ))}
        </div>

        <p className="text-center text-xs leading-[18px] text-(--text-3)">
          Signal Kit only asks for the permissions it needs to read your stream events. Your platform tokens stay encrypted on our server.
          By continuing you agree to the{" "}
          <Link href="/terms" className="text-(--text-2) underline underline-offset-2 hover:text-(--text)">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-(--text-2) underline underline-offset-2 hover:text-(--text)">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
