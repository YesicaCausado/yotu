-- Espacio privado de comunicación emocional para cada pareja.

create table public.couple_talk_threads (
  id                    uuid primary key default gen_random_uuid(),
  couple_id             uuid not null references public.couples (id) on delete cascade,
  created_by            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_key           uuid not null,
  category              text not null check (category in (
    'argument', 'upset', 'ignored', 'distant', 'disappointed', 'important', 'pending', 'other'
  )),
  story                 text not null check (char_length(btrim(story)) between 1 and 6000),
  emotions              text[] not null check (
    cardinality(emotions) > 0
    and emotions <@ array['sadness', 'anger', 'disappointment', 'frustration', 'anxiety', 'hurt', 'confusion', 'loneliness', 'vulnerable', 'affection', 'calm', 'exhausted']::text[]
  ),
  needs                 text[] not null check (
    cardinality(needs) > 0
    and needs <@ array['listen', 'affection', 'talk', 'apology', 'love', 'space', 'agreement', 'solution', 'understand', 'recognize']::text[]
  ),
  expectation           text not null check (expectation in (
    'talk_now', 'before_sleep', 'partner_initiative', 'time_to_think', 'reconcile', 'express_only'
  )),
  personal_message      text check (personal_message is null or char_length(personal_message) <= 3000),
  visibility            text not null default 'draft' check (visibility in ('draft', 'shared')),
  status                text not null default 'draft' check (status in (
    'draft', 'pending_read', 'read', 'conversation', 'in_progress', 'resolved'
  )),
  read_by               uuid[] not null default '{}',
  resolution_votes      uuid[] not null default '{}',
  pause_requested_by    uuid references auth.users (id) on delete set null,
  pause_requested_at    timestamptz,
  shared_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint couple_talk_request_unique unique (created_by, request_key),
  constraint couple_talk_visibility_status check (
    (visibility = 'draft' and status = 'draft' and shared_at is null)
    or (visibility = 'shared' and status <> 'draft' and shared_at is not null)
  )
);

create index couple_talk_threads_couple_created_idx
  on public.couple_talk_threads (couple_id, created_at desc);
create index couple_talk_threads_couple_status_idx
  on public.couple_talk_threads (couple_id, status, created_at desc);

create table public.couple_talk_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.couple_talk_threads (id) on delete cascade,
  couple_id    uuid not null references public.couples (id) on delete cascade,
  author_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_key  uuid not null,
  quick_reply  text check (quick_reply is null or quick_reply in (
    'talk_solve', 'affection', 'listen', 'understand', 'think'
  )),
  body         text check (body is null or char_length(body) <= 3000),
  emotions     text[] not null default '{}',
  needs        text[] not null default '{}',
  created_at   timestamptz not null default now(),
  constraint couple_talk_message_request_unique unique (author_id, request_key),
  constraint couple_talk_message_content check (
    (quick_reply is not null or (body is not null and char_length(btrim(body)) > 0))
    and emotions <@ array['sadness', 'anger', 'disappointment', 'frustration', 'anxiety', 'hurt', 'confusion', 'loneliness', 'vulnerable', 'affection', 'calm', 'exhausted']::text[]
    and needs <@ array['listen', 'affection', 'talk', 'apology', 'love', 'space', 'agreement', 'solution', 'understand', 'recognize']::text[]
  )
);

create index couple_talk_messages_thread_created_idx
  on public.couple_talk_messages (thread_id, created_at);

create table public.couple_talk_agreements (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.couple_talk_threads (id) on delete cascade,
  couple_id     uuid not null references public.couples (id) on delete cascade,
  request_key   uuid not null,
  proposed_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description   text not null check (char_length(btrim(description)) between 1 and 2000),
  accepted_by   uuid[] not null default '{}',
  rejected_by   uuid references auth.users (id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint couple_talk_agreement_request_unique unique (proposed_by, request_key)
);

create unique index couple_talk_one_pending_agreement
  on public.couple_talk_agreements (thread_id)
  where status = 'pending';
create index couple_talk_agreements_thread_created_idx
  on public.couple_talk_agreements (thread_id, created_at desc);

create table public.couple_talk_notifications (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references public.couples (id) on delete cascade,
  thread_id      uuid not null references public.couple_talk_threads (id) on delete cascade,
  recipient_id   uuid not null references auth.users (id) on delete cascade,
  actor_id       uuid references auth.users (id) on delete set null,
  event_type     text not null check (event_type in (
    'entry_shared', 'message_received', 'pause_requested', 'resolution_requested',
    'thread_resolved', 'agreement_proposed', 'agreement_accepted', 'agreement_rejected'
  )),
  created_at     timestamptz not null default now(),
  seen_at        timestamptz
);

create index couple_talk_notifications_recipient_idx
  on public.couple_talk_notifications (recipient_id, created_at desc);

alter table public.couple_talk_threads enable row level security;
alter table public.couple_talk_messages enable row level security;
alter table public.couple_talk_agreements enable row level security;
alter table public.couple_talk_notifications enable row level security;

revoke all on public.couple_talk_threads, public.couple_talk_messages,
  public.couple_talk_agreements, public.couple_talk_notifications
  from anon, authenticated;

grant select on public.couple_talk_threads, public.couple_talk_messages,
  public.couple_talk_agreements, public.couple_talk_notifications
  to authenticated;
grant update (seen_at) on public.couple_talk_notifications to authenticated;

create policy couple_talk_threads_select on public.couple_talk_threads
  for select to authenticated using (
    (visibility = 'draft' and created_by = (select auth.uid()))
    or (visibility = 'shared' and public.is_couple_member(couple_id))
  );

create policy couple_talk_messages_select on public.couple_talk_messages
  for select to authenticated using (
    couple_id = (select public.current_couple_id())
    and public.is_couple_member(couple_id)
    and exists (
      select 1 from public.couple_talk_threads thread
      where thread.id = couple_talk_messages.thread_id
        and thread.couple_id = couple_talk_messages.couple_id
        and thread.visibility = 'shared'
    )
  );

create policy couple_talk_agreements_select on public.couple_talk_agreements
  for select to authenticated using (
    couple_id = (select public.current_couple_id())
    and public.is_couple_member(couple_id)
    and exists (
      select 1 from public.couple_talk_threads thread
      where thread.id = couple_talk_agreements.thread_id
        and thread.couple_id = couple_talk_agreements.couple_id
        and thread.visibility = 'shared'
    )
  );

create policy couple_talk_notifications_select on public.couple_talk_notifications
  for select to authenticated using (
    recipient_id = (select auth.uid())
    and couple_id = (select public.current_couple_id())
    and public.is_couple_member(couple_id)
  );
create policy couple_talk_notifications_mark_seen on public.couple_talk_notifications
  for update to authenticated using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create trigger couple_talk_threads_updated_at before update on public.couple_talk_threads
  for each row execute function public.set_updated_at();
create trigger couple_talk_agreements_updated_at before update on public.couple_talk_agreements
  for each row execute function public.set_updated_at();

create function public.notify_couple_talk_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new_share boolean := false;
begin
  if new.visibility = 'shared' then
    if tg_op = 'INSERT' then
      v_is_new_share := true;
    else
      v_is_new_share := old.visibility is distinct from 'shared';
    end if;
  end if;

  if v_is_new_share then
    insert into public.couple_talk_notifications (
      couple_id, thread_id, recipient_id, actor_id, event_type
    )
    select new.couple_id, new.id, member.user_id, new.created_by, 'entry_shared'
    from public.couple_members member
    where member.couple_id = new.couple_id
      and member.user_id <> new.created_by;
  end if;
  return new;
end;
$$;

create trigger couple_talk_share_notification
  after insert or update of visibility on public.couple_talk_threads
  for each row execute function public.notify_couple_talk_share();

create function public.notify_couple_talk_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.couple_talk_threads
  set status = 'conversation',
      resolution_votes = '{}',
      updated_at = now()
  where id = new.thread_id
    and visibility = 'shared'
    and status <> 'draft';

  insert into public.couple_talk_notifications (
    couple_id, thread_id, recipient_id, actor_id, event_type
  )
  select new.couple_id, new.thread_id, member.user_id, new.author_id, 'message_received'
  from public.couple_members member
  where member.couple_id = new.couple_id
    and member.user_id <> new.author_id;
  return new;
end;
$$;

create trigger couple_talk_message_notification
  after insert on public.couple_talk_messages
  for each row execute function public.notify_couple_talk_message();

create function public.notify_couple_talk_agreement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.couple_talk_notifications (
      couple_id, thread_id, recipient_id, actor_id, event_type
    )
    select new.couple_id, new.thread_id, member.user_id, new.proposed_by, 'agreement_proposed'
    from public.couple_members member
    where member.couple_id = new.couple_id
      and member.user_id <> new.proposed_by;
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    v_type := case when new.status = 'accepted' then 'agreement_accepted' else 'agreement_rejected' end;
    insert into public.couple_talk_notifications (
      couple_id, thread_id, recipient_id, actor_id, event_type
    )
    select new.couple_id, new.thread_id, member.user_id, coalesce(new.rejected_by, (
      select user_id from public.couple_members
      where couple_id = new.couple_id and user_id <> new.proposed_by limit 1
    )), v_type
    from public.couple_members member
    where member.couple_id = new.couple_id
      and (new.status = 'accepted' or member.user_id = new.proposed_by);
  end if;
  return new;
end;
$$;

create trigger couple_talk_agreement_notification
  after insert or update of status on public.couple_talk_agreements
  for each row execute function public.notify_couple_talk_agreement();

create function public.save_couple_talk_entry(
  p_thread_id uuid,
  p_request_key uuid,
  p_action text,
  p_category text,
  p_story text,
  p_emotions text[],
  p_needs text[],
  p_expectation text,
  p_personal_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_partner_id uuid;
  v_thread public.couple_talk_threads%rowtype;
  v_thread_id uuid := p_thread_id;
  v_visibility text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if v_couple_id is null then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;
  if p_request_key is null
    or p_action is null or p_action not in ('draft', 'share')
    or p_category is null
    or p_category not in ('argument', 'upset', 'ignored', 'distant', 'disappointed', 'important', 'pending', 'other')
    or p_story is null or char_length(btrim(p_story)) not between 1 and 6000
    or p_emotions is null or cardinality(p_emotions) = 0
    or not (p_emotions <@ array['sadness', 'anger', 'disappointment', 'frustration', 'anxiety', 'hurt', 'confusion', 'loneliness', 'vulnerable', 'affection', 'calm', 'exhausted']::text[])
    or p_needs is null or cardinality(p_needs) = 0
    or not (p_needs <@ array['listen', 'affection', 'talk', 'apology', 'love', 'space', 'agreement', 'solution', 'understand', 'recognize']::text[])
    or p_expectation is null or p_expectation not in ('talk_now', 'before_sleep', 'partner_initiative', 'time_to_think', 'reconcile', 'express_only')
    or (p_personal_message is not null and char_length(p_personal_message) > 3000)
  then
    raise exception 'invalid_couple_talk_entry' using errcode = 'P0001';
  end if;

  select member.user_id into v_partner_id
  from public.couple_members member
  where member.couple_id = v_couple_id and member.user_id <> v_user_id;
  if p_action = 'share' and v_partner_id is null then
    raise exception 'partner_not_linked' using errcode = 'P0001';
  end if;

  if v_thread_id is null then
    select * into v_thread
    from public.couple_talk_threads
    where created_by = v_user_id and request_key = p_request_key
    for update;
    if found then
      v_thread_id := v_thread.id;
      if v_thread.visibility = 'shared' then
        return v_thread_id;
      end if;
    end if;
  else
    select * into v_thread
    from public.couple_talk_threads
    where id = v_thread_id
      and couple_id = v_couple_id
      and created_by = v_user_id
    for update;
    if not found then
      raise exception 'couple_talk_draft_not_found' using errcode = 'P0001';
    end if;
    if v_thread.visibility <> 'draft' then
      raise exception 'couple_talk_already_shared' using errcode = 'P0001';
    end if;
  end if;

  v_visibility := case when p_action = 'share' then 'shared' else 'draft' end;
  if v_thread_id is null then
    insert into public.couple_talk_threads (
      couple_id, created_by, request_key, category, story, emotions, needs,
      expectation, personal_message, visibility, status, shared_at
    ) values (
      v_couple_id, v_user_id, p_request_key, p_category, btrim(p_story), p_emotions, p_needs,
      p_expectation, nullif(btrim(p_personal_message), ''), v_visibility,
      case when p_action = 'draft' then 'draft' else 'pending_read' end,
      case when p_action = 'share' then now() else null end
    )
    returning id into v_thread_id;
  else
    update public.couple_talk_threads
    set category = p_category,
        story = btrim(p_story),
        emotions = p_emotions,
        needs = p_needs,
        expectation = p_expectation,
        personal_message = nullif(btrim(p_personal_message), ''),
        visibility = v_visibility,
        status = case when p_action = 'draft' then 'draft' else 'pending_read' end,
        shared_at = case when p_action = 'share' then now() else null end
    where id = v_thread_id;
  end if;

  return v_thread_id;
end;
$$;

create function public.delete_couple_talk_draft(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.couple_talk_threads
  where id = p_thread_id
    and couple_id = public.current_couple_id()
    and created_by = auth.uid()
    and visibility = 'draft';
  if not found then
    raise exception 'couple_talk_draft_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.mark_couple_talk_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  update public.couple_talk_threads
  set read_by = case when v_user_id = any(read_by) then read_by else array_append(read_by, v_user_id) end,
      status = case when status = 'pending_read' and created_by <> v_user_id then 'read' else status end
  where id = p_thread_id
    and couple_id = public.current_couple_id()
    and visibility = 'shared'
    and public.is_couple_member(couple_id);
  if not found then
    raise exception 'couple_talk_thread_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.add_couple_talk_message(
  p_thread_id uuid,
  p_request_key uuid,
  p_quick_reply text,
  p_body text,
  p_emotions text[],
  p_needs text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_request_key is null
    or (p_quick_reply is not null and p_quick_reply not in ('talk_solve', 'affection', 'listen', 'understand', 'think'))
    or (p_body is not null and char_length(p_body) > 3000)
    or (p_quick_reply is null and (p_body is null or char_length(btrim(p_body)) = 0))
    or p_emotions is null
    or not (p_emotions <@ array['sadness', 'anger', 'disappointment', 'frustration', 'anxiety', 'hurt', 'confusion', 'loneliness', 'vulnerable', 'affection', 'calm', 'exhausted']::text[])
    or p_needs is null
    or not (p_needs <@ array['listen', 'affection', 'talk', 'apology', 'love', 'space', 'agreement', 'solution', 'understand', 'recognize']::text[])
  then
    raise exception 'invalid_couple_talk_message' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.couple_talk_threads thread
    where thread.id = p_thread_id
      and thread.couple_id = v_couple_id
      and thread.visibility = 'shared'
      and public.is_couple_member(thread.couple_id)
  ) then
    raise exception 'couple_talk_thread_not_found' using errcode = 'P0001';
  end if;

  select message.id into v_message_id
  from public.couple_talk_messages message
  where message.thread_id = p_thread_id
    and message.author_id = v_user_id
    and message.request_key = p_request_key;
  if v_message_id is not null then return v_message_id; end if;

  insert into public.couple_talk_messages (
    thread_id, couple_id, author_id, request_key, quick_reply, body, emotions, needs
  ) values (
    p_thread_id, v_couple_id, v_user_id, p_request_key, p_quick_reply,
    nullif(btrim(p_body), ''), p_emotions, p_needs
  )
  returning id into v_message_id;
  return v_message_id;
end;
$$;

create function public.set_couple_talk_progress(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.couple_talk_threads
  set status = 'in_progress'
  where id = p_thread_id
    and couple_id = public.current_couple_id()
    and visibility = 'shared'
    and status <> 'resolved'
    and public.is_couple_member(couple_id);
  if not found then
    raise exception 'couple_talk_thread_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.set_couple_talk_pause(p_thread_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_recipient uuid;
  v_previous_requester uuid;
begin
  if p_paused is null then
    raise exception 'invalid_couple_talk_pause' using errcode = 'P0001';
  end if;

  select thread.pause_requested_by into v_previous_requester
  from public.couple_talk_threads thread
  where thread.id = p_thread_id
    and thread.couple_id = v_couple_id
    and thread.visibility = 'shared'
    and public.is_couple_member(thread.couple_id)
  for update;
  if not found then
    raise exception 'couple_talk_thread_not_found' using errcode = 'P0001';
  end if;

  if p_paused then
    if v_previous_requester is null then
      select member.user_id into v_recipient
      from public.couple_members member
      where member.couple_id = v_couple_id and member.user_id <> v_user_id;

      update public.couple_talk_threads
      set pause_requested_by = v_user_id, pause_requested_at = now()
      where id = p_thread_id;

      if v_recipient is not null then
        insert into public.couple_talk_notifications (
          couple_id, thread_id, recipient_id, actor_id, event_type
        ) values (v_couple_id, p_thread_id, v_recipient, v_user_id, 'pause_requested');
      end if;
    end if;
  else
    update public.couple_talk_threads
    set pause_requested_by = null, pause_requested_at = null
    where id = p_thread_id;
  end if;
end;
$$;

create function public.set_couple_talk_resolution(p_thread_id uuid, p_ready boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_thread public.couple_talk_threads%rowtype;
  v_votes uuid[];
  v_member_count integer;
  v_status text;
begin
  if p_ready is null then
    raise exception 'invalid_couple_talk_resolution' using errcode = 'P0001';
  end if;

  select * into v_thread
  from public.couple_talk_threads
  where id = p_thread_id
    and couple_id = v_couple_id
    and visibility = 'shared'
    and public.is_couple_member(couple_id)
  for update;
  if not found then
    raise exception 'couple_talk_thread_not_found' using errcode = 'P0001';
  end if;

  v_votes := array_remove(v_thread.resolution_votes, v_user_id);
  if p_ready then v_votes := array_append(v_votes, v_user_id); end if;

  select count(*) into v_member_count
  from public.couple_members
  where couple_id = v_couple_id;
  if v_member_count <> 2 then
    raise exception 'couple_not_ready' using errcode = 'P0001';
  end if;

  if p_ready and v_user_id = any(v_thread.resolution_votes) then
    return v_thread.status;
  end if;

  v_status := case when cardinality(v_votes) = v_member_count then 'resolved' else 'in_progress' end;
  update public.couple_talk_threads
  set resolution_votes = v_votes, status = v_status
  where id = p_thread_id;

  if v_status = 'resolved' then
    insert into public.couple_talk_notifications (
      couple_id, thread_id, recipient_id, actor_id, event_type
    )
    select v_couple_id, p_thread_id, member.user_id, v_user_id, 'thread_resolved'
    from public.couple_members member
    where member.couple_id = v_couple_id;
  elsif p_ready then
    insert into public.couple_talk_notifications (
      couple_id, thread_id, recipient_id, actor_id, event_type
    )
    select v_couple_id, p_thread_id, member.user_id, v_user_id, 'resolution_requested'
    from public.couple_members member
    where member.couple_id = v_couple_id and member.user_id <> v_user_id;
  end if;

  return v_status;
end;
$$;

create function public.propose_couple_talk_agreement(
  p_thread_id uuid,
  p_request_key uuid,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_agreement_id uuid;
begin
  if p_request_key is null or p_description is null
    or char_length(btrim(p_description)) not between 1 and 2000
  then
    raise exception 'invalid_couple_talk_agreement' using errcode = 'P0001';
  end if;

  select id into v_agreement_id
  from public.couple_talk_agreements
  where proposed_by = v_user_id and request_key = p_request_key;
  if v_agreement_id is not null then return v_agreement_id; end if;

  if not exists (
    select 1 from public.couple_talk_threads thread
    where thread.id = p_thread_id
      and thread.couple_id = v_couple_id
      and thread.visibility = 'shared'
      and thread.status = 'resolved'
      and cardinality(thread.resolution_votes) = 2
      and (
        select count(*) from public.couple_members member
        where member.couple_id = thread.couple_id
          and member.user_id = any(thread.resolution_votes)
      ) = 2
      and public.is_couple_member(thread.couple_id)
  ) then
    raise exception 'couple_talk_not_mutually_resolved' using errcode = 'P0001';
  end if;

  insert into public.couple_talk_agreements (
    thread_id, couple_id, request_key, proposed_by, description, accepted_by
  ) values (
    p_thread_id, v_couple_id, p_request_key, v_user_id, btrim(p_description), array[v_user_id]
  )
  returning id into v_agreement_id;
  return v_agreement_id;
end;
$$;

create function public.respond_to_couple_talk_agreement(p_agreement_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_agreement public.couple_talk_agreements%rowtype;
begin
  if p_accept is null then
    raise exception 'invalid_couple_talk_agreement_response' using errcode = 'P0001';
  end if;

  select * into v_agreement
  from public.couple_talk_agreements agreement
  where agreement.id = p_agreement_id
    and agreement.couple_id = public.current_couple_id()
    and agreement.status = 'pending'
    and agreement.proposed_by <> v_user_id
    and public.is_couple_member(agreement.couple_id)
  for update;
  if not found then
    raise exception 'couple_talk_agreement_not_found' using errcode = 'P0001';
  end if;

  if p_accept then
    update public.couple_talk_agreements
    set accepted_by = array_append(accepted_by, v_user_id), status = 'accepted'
    where id = p_agreement_id;
  else
    update public.couple_talk_agreements
    set rejected_by = v_user_id, status = 'rejected'
    where id = p_agreement_id;
  end if;
end;
$$;

revoke all on function public.notify_couple_talk_share() from public, anon, authenticated;
revoke all on function public.notify_couple_talk_message() from public, anon, authenticated;
revoke all on function public.notify_couple_talk_agreement() from public, anon, authenticated;
revoke all on function public.save_couple_talk_entry(uuid, uuid, text, text, text, text[], text[], text, text) from public, anon, authenticated;
revoke all on function public.delete_couple_talk_draft(uuid) from public, anon, authenticated;
revoke all on function public.mark_couple_talk_read(uuid) from public, anon, authenticated;
revoke all on function public.add_couple_talk_message(uuid, uuid, text, text, text[], text[]) from public, anon, authenticated;
revoke all on function public.set_couple_talk_progress(uuid) from public, anon, authenticated;
revoke all on function public.set_couple_talk_pause(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_couple_talk_resolution(uuid, boolean) from public, anon, authenticated;
revoke all on function public.propose_couple_talk_agreement(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.respond_to_couple_talk_agreement(uuid, boolean) from public, anon, authenticated;

grant execute on function public.save_couple_talk_entry(uuid, uuid, text, text, text, text[], text[], text, text) to authenticated;
grant execute on function public.delete_couple_talk_draft(uuid) to authenticated;
grant execute on function public.mark_couple_talk_read(uuid) to authenticated;
grant execute on function public.add_couple_talk_message(uuid, uuid, text, text, text[], text[]) to authenticated;
grant execute on function public.set_couple_talk_progress(uuid) to authenticated;
grant execute on function public.set_couple_talk_pause(uuid, boolean) to authenticated;
grant execute on function public.set_couple_talk_resolution(uuid, boolean) to authenticated;
grant execute on function public.propose_couple_talk_agreement(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_couple_talk_agreement(uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.couple_talk_threads;
alter publication supabase_realtime add table public.couple_talk_messages;
alter publication supabase_realtime add table public.couple_talk_agreements;
alter publication supabase_realtime add table public.couple_talk_notifications;
