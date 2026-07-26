"use client";

import { useEffect } from "react";
import { captureClientError } from "@/lib/sentry/client";
import "@/app/globals.css";

/**
 * Last resort: the root layout itself failed, so React replaces the whole
 * document. Nothing from the app shell is available here — no fonts, no shared
 * components' context — so this is intentionally plain, self-contained markup
 * that still reads as Sevri rather than as a stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, { surface: "global_error", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="app-shell min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Sevri</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink">
            Something went badly wrong.
          </h1>
          <p className="mt-4 text-base leading-7 text-ink-soft">
            Your account and your saved work aren&apos;t affected. Reloading usually clears this; if it
            doesn&apos;t, email{" "}
            <a className="font-semibold text-ink underline" href="mailto:support@sevri.co">
              support@sevri.co
            </a>
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Reload the page
            </button>
            {/* A plain anchor on purpose: the root layout is what failed, so the
                client router cannot be trusted to navigate. A full document load
                is the recovery. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-paper px-5 text-sm font-semibold text-ink"
            >
              Go to the homepage
            </a>
          </div>

          {error.digest ? (
            <p className="mt-8 text-xs text-ink-muted">
              Reference code <code className="font-semibold text-ink-soft">{error.digest}</code> — include it if
              you contact support.
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
