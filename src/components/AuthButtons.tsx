"use client";

import { useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export type ProviderId = "twitch" | "google" | "twitter";

/**
 * Starts an OAuth flow. "signin" logs in (or signs up); "link" connects another account to the
 * signed-in user. The server picks the scopes from the provider and role.
 */
export function ConnectButton({
  provider,
  mode,
  role = "broadcaster",
  className,
  children,
}: {
  provider: ProviderId;
  mode: "signin" | "link";
  role?: "broadcaster" | "bot";
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result =
      mode === "signin"
        ? await authClient.signIn.social({ provider, callbackURL: "/dashboard", errorCallbackURL: "/dashboard" })
        : await authClient.linkSocial({
            provider,
            callbackURL: "/dashboard",
            errorCallbackURL: "/dashboard",
            additionalData: { role },
          });
    if (result.error) {
      setError(result.error.message ?? "Could not start sign-in.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={start} disabled={pending} className={className}>
        {pending ? "Redirecting…" : children}
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/dashboard");
      }}
    >
      Sign out
    </button>
  );
}
