import Link from "next/link";
import { DashboardClient } from "@/components/DashboardClient";
import { Logo } from "@/components/Logo";
import { getDashboardData } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);

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
              <h1 className="mt-4 max-w-[28ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Connect Twitch or YouTube to start the relay.
              </h1>
              <p className="mt-5 max-w-[60ch] text-pretty text-neutral-600">
                Start with Twitch EventSub or YouTube Live Chat. You can link the other provider
                from the dashboard later. Tokens are stored encrypted and never leave the server.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href="/api/auth/twitch/start"
                  className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  Continue with Twitch
                </a>
                <a
                  href="/api/auth/youtube/start"
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                >
                  Continue with YouTube
                </a>
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
                {user.displayName}
              </h1>
              <p className="mt-2 font-mono text-sm text-neutral-500">
                {user.primaryProvider} login · {user.twitchLogin ? `@${user.twitchLogin}` : "Twitch not connected"}
              </p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>
        <DashboardClient
          initialTokens={data.tokens}
          accounts={data.accounts}
          hasTwitch={data.hasTwitch}
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
