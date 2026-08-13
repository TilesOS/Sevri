-- Add the missing covering index for email_messages.intake_id.
--
-- The FK email_messages_intake_id_fkey has had no referencing-side index since
-- email_messages was created in 20260807164447_email_lifecycle_automation.
-- Without it, every delete from public.intakes forces a sequential scan of
-- email_messages to enforce the constraint.
--
-- Plain CREATE INDEX (not CONCURRENTLY): migrations run inside a transaction,
-- and the table is small enough that the brief write lock is not a concern.

create index if not exists idx_email_messages_intake_id
  on public.email_messages (intake_id);
