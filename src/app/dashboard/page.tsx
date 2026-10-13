import Link from "next/link";
import { ConnectButton, SignOutButton } from "@/components/AuthButtons";
import { DashboardClient } from "@/components/DashboardClient";
import { Logo } from "@/components/Logo";
import { enabledProviders, getDashboardData } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";

/** Better Auth error codes that reach the dashboard via errorCallbackURL. */
const AUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "That account isn't connected to a Signal Kit user yet. Sign in with an account you already connected, then connect this one from Accounts.",
  account_already_linked_to_different_user: "That account is already connected to a different Signal Kit user.",
  "email_doesn't_match": "That account's email doesn't match. Sign in first, then connect it from Accounts.",
  access_denied: "Sign-in was cancelled.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  const { error } = await searchParams;
  const errorMessage = error ? (AUTH_ERRORS[error] ?? `Sign-in failed (${error}).`) : null;
  const providers = enabledProviders();

  if (!user) {
    return (
      <>
        <DashboardHeader />
        <main className="flex-1">
          <section>
            <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-24 sm:pt-24">
              <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
                Sign in
              </p>
              {errorMessage ? <AuthError message={errorMessage} /> : null}
              <h1 className="mt-4 max-w-[28ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Sign in with Twitch, YouTube, or X to start the relay.
              </h1>
              <p className="mt-5 max-w-[60ch] text-pretty text-neutral-600">
                Start with any platform. You can connect more accounts from the dashboard later.
                Platform tokens are stored encrypted and never leave the server.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <ConnectButton provider="twitch" mode="signin" className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
            Continue with Twitch
          </ConnectButton>
                <ConnectButton provider="google" mode="signin" className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950">
            Continue with YouTube
          </ConnectButton>
                {providers.twitter ? (
                  <ConnectButton
                    provider="twitter"
                    mode="signin"
                    className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                  >
                    Continue with X
                  </ConnectButton>
                ) : null}
                <Link
                  href="/docs"
                  className="text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
                >
                  Read the docs <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
        <DashboardFooter />
      </>
    );
  }

  const data = await getDashboardData(user);
  return (
    <>
      <DashboardHeader />
      <main className="flex-1">
        <section className="border-b border-neutral-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pt-12 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
                Workspace
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {user.name}
              </h1>
              <p className="mt-2 font-mono text-sm text-neutral-500">
                {data.connections.length} connected account{data.connections.length === 1 ? "" : "s"}
              </p>
              {errorMessage ? <AuthError message={errorMessage} /> : null}
            </div>
            <SignOutButton className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950" />
          </div>
        </section>
        <DashboardClient
          initialKeys={data.keys}
          connections={data.connections}
          providers={data.providers}
          events={data.events}
          wsUrl={data.wsUrl}
          appUrl={data.appUrl}
          snippets={data.snippets}
          highlighted={data.highlighted}
        />
      </main>
      <DashboardFooter />
    </>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-4 max-w-[70ch] rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      {message}
    </div>
  );
}

function DashboardHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm text-neutral-600">
          <Link
            href="/docs"
            className="rounded-md px-3 py-2 hover:bg-neutral-100 hover:text-neutral-950"
          >
            Docs
          </Link>
          <Link href="/dashboard" className="rounded-md px-3 py-2 text-neutral-950">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

function DashboardFooter() {
  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Signal Kit · An indie project
        </p>
        <nav className="flex items-center gap-6 text-sm text-neutral-600">
          <Link href="/" className="font-normal hover:text-neutral-950">
            Home
          </Link>
          <Link href="/docs" className="font-normal hover:text-neutral-950">
            Docs
          </Link>
        </nav>
      </div>
    </footer>
  );
}
