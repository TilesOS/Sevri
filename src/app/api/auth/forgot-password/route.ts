import { NextResponse } from "next/server";
import { z } from "zod";
import { clientEnv } from "@/lib/env";
import { captureServerError } from "@/lib/sentry/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consumePasswordRecoveryRateLimits,
  releasePasswordRecoveryRateLimits,
  reservePasswordRecoveryRateLimits,
} from "@/lib/usage/auth-rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("That email address doesn't look right."),
});

/**
 * The same answer is returned whether or not an account exists, so this endpoint
 * can't be used to discover which students have Sevri accounts.
 */
const NEUTRAL_MESSAGE =
  "If that email has a Sevri account, a reset link is on its way. It expires in about an hour.";

/** Per-address limit: enough for a mistyped address, not enough to mailbomb one. */
const EMAIL_LIMIT = { maxRequests: 3, windowMinutes: 15 } as const;
/** Per-client limit, so one visitor can't walk a list of addresses. */
const IP_LIMIT = { maxRequests: 10, windowMinutes: 15 } as const;

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimitedResponse(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.round(retryAfterSeconds / 60));

  return NextResponse.json(
    {
      error: `Too many reset requests for now. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or email support@sevri.co if you're locked out.`,
      code: "rate_limited",
      retry_after_seconds: retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request) {
  let payload: z.infer<typeof bodySchema>;

  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Check the email address and try again."
        : "Check the email address and try again.";

    return NextResponse.json({ error: message, code: "invalid_email" }, { status: 400 });
  }

  const email = payload.email.toLowerCase();
  let reservationIds: string[] = [];

  // IP and email are checked and reserved in one transaction. The RPC checks
  // IP first, so a blocked client cannot consume arbitrary address quotas.
  try {
    const limit = await reservePasswordRecoveryRateLimits({
      email,
      ip: getClientIp(request),
      emailLimit: EMAIL_LIMIT,
      ipLimit: IP_LIMIT,
    });

    if (!limit.allowed) {
      return rateLimitedResponse(limit.retryAfterSeconds);
    }

    reservationIds = limit.reservationIds;
  } catch (rateLimitError) {
    captureServerError(rateLimitError, { route: "auth/forgot-password", stage: "rate-limit" });

    return NextResponse.json(
      {
        error: "We couldn't start a password reset just now. Try again in a moment.",
        code: "recovery_unavailable",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    // The link lands on the code-exchange route, which establishes the recovery
    // session and then forwards to the form where the new password is chosen.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=%2Freset-password`,
    });

    if (error) {
      // Supabase's own email throttle is the one failure worth naming, because
      // the recoverable action ("wait, then retry") differs from ours.
      if (/rate limit/i.test(error.message)) {
        return rateLimitedResponse(EMAIL_LIMIT.windowMinutes * 60);
      }

      // Supabase returns success for addresses without an account, so an error
      // here is a real send failure, not a hint about who has an account. Saying
      // so beats a cheerful "check your inbox" for mail that never arrives.
      throw new Error(`Failed to send recovery email: ${error.message}`);
    }

    const completedReservationIds = reservationIds;
    reservationIds = [];
    await consumePasswordRecoveryRateLimits(completedReservationIds);
  } catch (error) {
    captureServerError(error, { route: "auth/forgot-password", stage: "send-recovery-email" });

    return NextResponse.json(
      {
        error: "We couldn't send the reset email just now. Try again in a moment, or email support@sevri.co.",
        code: "recovery_email_failed",
      },
      { status: 502 },
    );
  } finally {
    if (reservationIds.length > 0) {
      await releasePasswordRecoveryRateLimits(reservationIds).catch((releaseError) => {
        captureServerError(releaseError, {
          route: "auth/forgot-password",
          stage: "release-rate-limit",
        });
      });
    }
  }

  return NextResponse.json({ message: NEUTRAL_MESSAGE }, { status: 200 });
}
