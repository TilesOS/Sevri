# Email lifecycle operations

Sevri sends immediate service messages through `hello@sevri.co` and project notifications through `coach@sevri.co`. `support@sevri.co` and `suggestions@sevri.co` remain inbound aliases.

## Rollout order

1. Apply `supabase/migrations/20260807164447_email_lifecycle_automation.sql` before deploying the application.
2. Configure the environment variables below in Vercel. Do not enable `EMAIL_POSTAL_ADDRESS` until it is a valid current street address, registered private mailbox, or USPS address suitable for the messages being sent.
3. Deploy. Vercel calls `/api/cron/email-sequences` daily at 16:00 UTC.
4. In Resend, add a webhook endpoint at `https://sevri.co/api/email/webhook` for sent, delivered, failed, bounced, complained, and suppressed events. Store its signing secret as `RESEND_WEBHOOK_SECRET`.
5. Publish a DMARC record for `sevri.co` after validating the policy with the Google Workspace mail flow.

## Environment

- `RESEND_API_KEY`: server-side Resend API key.
- `RESEND_WEBHOOK_SECRET`: webhook signing secret from Resend.
- `CRON_SECRET`: high-entropy secret used by Vercel's `Authorization: Bearer` cron request.
- `EMAIL_UNSUBSCRIBE_SECRET`: at least 32 random characters used to sign unsubscribe links. Rotating it invalidates existing links.
- `EMAIL_POSTAL_ADDRESS`: the exact compliant postal address printed in optional email footers.

Activation and coaching messages are launch-gated unless every lifecycle variable is valid. Welcome and roadmap-ready service messages do not depend on the postal address.

## Sequences

- Hello: day 3 and day 7 after onboarding when no project has been selected.
- Coach: day 7 and day 14 after the latest meaningful project activity, then no more email until new progress creates a new activity cycle.
- The global coach cap is one message per user per seven days.
- Progress includes milestone completion, submission, checklist changes, completed focus blocks, completed scheduled work sessions, and commits in a connected GitHub repository.
- GitHub is refreshed before a coach message. If that refresh fails, the message is skipped rather than risking a false inactivity reminder.

Existing users are inserted as disabled. Accounts created after the migration see the onboarding choice enabled by default and can opt out before submitting. All users can change the preference in Settings or use the signed one-click unsubscribe endpoint.

## Delivery safety

The outbox uses a unique sequence key and a provider idempotency key. Cron workers atomically claim rows, retry failures up to three times, and recover claims stuck for more than 15 minutes. Resend webhook IDs are stored for deduplication, and older out-of-order events cannot overwrite newer state. Bounces, complaints, and suppression events disable optional email for the affected user.
