alter table public.milestone_submissions
  add column evidence_submission_id uuid
  references public.milestone_submissions(id) on delete set null;

alter table public.milestone_submissions
  add constraint milestone_submissions_evidence_not_self_check
  check (evidence_submission_id is null or evidence_submission_id <> id);

create index idx_milestone_submissions_evidence_submission
  on public.milestone_submissions(evidence_submission_id)
  where evidence_submission_id is not null;

drop function public.create_milestone_artifact_bundle_with_pending_evaluation(uuid, text, jsonb);

create function public.create_milestone_artifact_bundle_with_pending_evaluation(
  p_milestone_id uuid,
  p_submission_text text,
  p_artifacts jsonb,
  p_evidence_submission_id uuid default null
)
returns table (
  submission_id uuid,
  evaluation_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created record;
  v_artifact jsonb;
  v_count integer;
  v_total_bytes bigint;
begin
  if jsonb_typeof(coalesce(p_artifacts, '[]'::jsonb)) <> 'array' then
    raise exception 'Artifacts must be an array';
  end if;

  v_count := jsonb_array_length(coalesce(p_artifacts, '[]'::jsonb));
  if v_count > 5 then raise exception 'A submission can include at most 5 evidence items'; end if;
  if v_count > 0 and p_evidence_submission_id is not null then
    raise exception 'Choose uploaded evidence or a referenced evidence submission';
  end if;

  if p_evidence_submission_id is not null and not exists (
    select 1
    from public.milestone_submissions s
    where s.id = p_evidence_submission_id
      and s.milestone_id = p_milestone_id
      and s.user_id = auth.uid()
  ) then
    raise exception 'Referenced evidence submission was not found for this step';
  end if;

  select coalesce(sum(coalesce((item->>'size_bytes')::bigint, 0)), 0)
  into v_total_bytes
  from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb)) item;
  if v_total_bytes > 26214400 then raise exception 'Evidence bundle exceeds 25 MB'; end if;

  select * into v_created
  from private.create_milestone_submission_with_pending_evaluation(
    p_milestone_id,
    case when v_count > 0 or p_evidence_submission_id is not null then 'artifact_bundle' else 'pasted_text' end,
    nullif(trim(coalesce(p_submission_text, '')), ''),
    null
  );

  update public.milestone_submissions
  set evidence_submission_id = p_evidence_submission_id
  where id = v_created.submission_id
    and user_id = auth.uid();

  for v_artifact in select value from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb))
  loop
    if ((v_artifact ? 'upload_path') = (v_artifact ? 'external_url')) then
      raise exception 'Each evidence item needs exactly one source';
    end if;
    if v_artifact ? 'upload_path' and split_part(v_artifact->>'upload_path', '/', 1) <> auth.uid()::text then
      raise exception 'Upload path is outside the current user folder';
    end if;
    if v_artifact ? 'external_url' and (v_artifact->>'external_url') !~ '^https://' then
      raise exception 'External evidence URLs must use HTTPS';
    end if;
    insert into public.milestone_submission_artifacts (
      submission_id, owner_user_id, upload_path, external_url, display_name,
      mime_type, size_bytes, caption, alt_text
    ) values (
      v_created.submission_id, auth.uid(), v_artifact->>'upload_path', v_artifact->>'external_url',
      left(coalesce(nullif(trim(v_artifact->>'display_name'), ''), 'Evidence item'), 180),
      nullif(v_artifact->>'mime_type', ''), nullif(v_artifact->>'size_bytes', '')::bigint,
      nullif(trim(v_artifact->>'caption'), ''), nullif(trim(v_artifact->>'alt_text'), '')
    );
  end loop;

  return query select v_created.submission_id::uuid, v_created.evaluation_id::uuid;
end;
$$;

revoke all on function public.create_milestone_artifact_bundle_with_pending_evaluation(uuid, text, jsonb, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_milestone_artifact_bundle_with_pending_evaluation(uuid, text, jsonb, uuid)
to authenticated;
