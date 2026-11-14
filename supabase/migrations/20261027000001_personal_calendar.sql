-- Calendario personal con información sensible separada de los horarios visibles.

create table public.personal_activities (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_key   uuid not null,
  activity_date date not null,
  start_time    time not null,
  end_time      time not null,
  visibility    text not null default 'private' check (visibility in ('private', 'availability', 'shared')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint personal_activities_time_order check (end_time > start_time),
  constraint personal_activities_id_user_unique unique (id, user_id),
  constraint personal_activities_request_unique unique (user_id, request_key)
);

create index personal_activities_couple_date_idx
  on public.personal_activities (couple_id, activity_date, start_time);

create table public.personal_activity_details (
  activity_id   uuid primary key,
  user_id       uuid not null,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  description   text check (description is null or char_length(description) <= 3000),
  category      text not null check (category in ('university', 'work', 'study', 'exercise', 'errands', 'family', 'personal', 'rest', 'other')),
  location      text check (location is null or char_length(location) <= 200),
  personal_notes text check (personal_notes is null or char_length(personal_notes) <= 3000),
  color         text not null default '#C66B82' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint personal_activity_details_owner_fkey
    foreign key (activity_id, user_id)
    references public.personal_activities (id, user_id)
    on delete cascade
);

alter table public.personal_activities enable row level security;
revoke all on public.personal_activities from anon, authenticated;

create policy personal_activities_select on public.personal_activities for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      couple_id = (select public.current_couple_id())
      and visibility <> 'private'
      and exists (
        select 1 from public.couple_members member
        where member.couple_id = personal_activities.couple_id
          and member.user_id = personal_activities.user_id
      )
    )
  );

create trigger personal_activities_updated_at before update on public.personal_activities
  for each row execute function public.set_updated_at();

alter table public.personal_activity_details enable row level security;
revoke all on public.personal_activity_details from anon, authenticated;

create policy personal_activity_details_owner_only on public.personal_activity_details for select to authenticated
  using (user_id = (select auth.uid()));

create table public.personal_day_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_key  uuid not null,
  note_date    date not null,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  content      text check (content is null or char_length(content) <= 5000),
  reminder_at  timestamptz,
  is_task      boolean not null default false,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint personal_day_notes_request_unique unique (user_id, request_key)
);

create index personal_day_notes_owner_date_idx on public.personal_day_notes (user_id, note_date);
alter table public.personal_day_notes enable row level security;
revoke all on public.personal_day_notes from anon, authenticated;
grant select on public.personal_day_notes to authenticated;
grant insert (user_id, request_key, note_date, title, content, reminder_at, is_task, is_completed)
  on public.personal_day_notes to authenticated;
grant update (note_date, title, content, reminder_at, is_task, is_completed)
  on public.personal_day_notes to authenticated;
grant delete on public.personal_day_notes to authenticated;

create policy personal_day_notes_owner_only on public.personal_day_notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger personal_day_notes_updated_at before update on public.personal_day_notes
  for each row execute function public.set_updated_at();

create table public.calendar_sync_state (
  couple_id  uuid primary key references public.couples (id) on delete cascade,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.calendar_sync_state enable row level security;
revoke all on public.calendar_sync_state from anon, authenticated;
grant select on public.calendar_sync_state to authenticated;

create policy calendar_sync_state_members on public.calendar_sync_state for select to authenticated
  using (public.is_couple_member(couple_id));

create function public.bump_calendar_sync_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple_id uuid;
  v_visible_change boolean := false;
begin
  if tg_op = 'INSERT' then
    v_couple_id := new.couple_id;
    v_visible_change := new.visibility <> 'private';
  elsif tg_op = 'UPDATE' then
    v_couple_id := new.couple_id;
    v_visible_change := old.visibility <> 'private' or new.visibility <> 'private';
  else
    v_couple_id := old.couple_id;
    v_visible_change := old.visibility <> 'private';
  end if;

  if v_visible_change then
    insert into public.calendar_sync_state (couple_id, version, updated_at)
    values (v_couple_id, 1, now())
    on conflict (couple_id) do update
      set version = public.calendar_sync_state.version + 1,
          updated_at = excluded.updated_at;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger personal_activities_calendar_sync
  after insert or update or delete on public.personal_activities
  for each row execute function public.bump_calendar_sync_state();

create function public.bump_calendar_sync_for_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple_id uuid;
begin
  if tg_op = 'DELETE' then
    v_couple_id := old.couple_id;
  else
    v_couple_id := new.couple_id;
  end if;

  if tg_op = 'DELETE'
    and not exists (select 1 from public.couples where id = v_couple_id)
  then
    return old;
  end if;

  if tg_op = 'DELETE'
    and not exists (select 1 from public.couple_members where couple_id = v_couple_id)
  then
    return old;
  end if;

  insert into public.calendar_sync_state (couple_id, version, updated_at)
  values (v_couple_id, 1, now())
  on conflict (couple_id) do update
    set version = public.calendar_sync_state.version + 1,
        updated_at = excluded.updated_at;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger couple_members_calendar_sync
  after insert or delete on public.couple_members
  for each row execute function public.bump_calendar_sync_for_membership();

create function public.touch_activity_after_details_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.title, old.description, old.category, old.location, old.color)
      is distinct from (new.title, new.description, new.category, new.location, new.color) then
    update public.personal_activities
    set updated_at = now()
    where id = new.activity_id
      and visibility = 'shared';
  end if;
  return new;
end;
$$;

create trigger personal_activity_details_updated
  after update on public.personal_activity_details
  for each row execute function public.touch_activity_after_details_change();

create function public.save_personal_activity(
  p_activity_id uuid,
  p_request_key uuid,
  p_title text,
  p_description text,
  p_activity_date date,
  p_start_time time,
  p_end_time time,
  p_category text,
  p_location text,
  p_personal_notes text,
  p_color text,
  p_visibility text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_activity_id uuid := p_activity_id;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if v_couple_id is null then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;
  if p_request_key is null
    or p_title is null
    or char_length(btrim(p_title)) not between 1 and 120
    or (p_description is not null and char_length(p_description) > 3000)
    or (p_location is not null and char_length(p_location) > 200)
    or (p_personal_notes is not null and char_length(p_personal_notes) > 3000)
    or p_activity_date is null
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_category not in ('university', 'work', 'study', 'exercise', 'errands', 'family', 'personal', 'rest', 'other')
    or p_color !~ '^#[0-9A-Fa-f]{6}$'
    or p_visibility not in ('private', 'availability', 'shared')
  then
    raise exception 'invalid_personal_activity' using errcode = 'P0001';
  end if;

  if v_activity_id is null then
    insert into public.personal_activities (
      couple_id, user_id, request_key, activity_date, start_time, end_time, visibility
    )
    values (
      v_couple_id, v_user_id, p_request_key, p_activity_date, p_start_time, p_end_time, p_visibility
    )
    on conflict (user_id, request_key) do nothing
    returning id into v_activity_id;

    if v_activity_id is null then
      select id into v_activity_id
      from public.personal_activities
      where user_id = v_user_id and request_key = p_request_key;
      return v_activity_id;
    end if;

    insert into public.personal_activity_details (
      activity_id, user_id, title, description, category, location, personal_notes, color
    )
    values (
      v_activity_id, v_user_id, btrim(p_title), nullif(btrim(p_description), ''),
      p_category, nullif(btrim(p_location), ''), nullif(btrim(p_personal_notes), ''), p_color
    );
  else
    update public.personal_activities
    set activity_date = p_activity_date,
        start_time = p_start_time,
        end_time = p_end_time,
        visibility = p_visibility
    where id = v_activity_id
      and user_id = v_user_id
      and couple_id = v_couple_id
      and (activity_date, start_time, end_time, visibility)
        is distinct from (p_activity_date, p_start_time, p_end_time, p_visibility);

    if not found and not exists (
      select 1 from public.personal_activities
      where id = v_activity_id and user_id = v_user_id and couple_id = v_couple_id
    ) then
      raise exception 'personal_activity_not_found' using errcode = 'P0001';
    end if;

    update public.personal_activity_details
    set title = btrim(p_title),
        description = nullif(btrim(p_description), ''),
        category = p_category,
        location = nullif(btrim(p_location), ''),
        personal_notes = nullif(btrim(p_personal_notes), ''),
        color = p_color
    where activity_id = v_activity_id and user_id = v_user_id;

    if not found then
      raise exception 'personal_activity_details_not_found' using errcode = 'P0001';
    end if;
  end if;

  return v_activity_id;
end;
$$;

create function public.delete_personal_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.personal_activities
  where id = p_activity_id
    and user_id = auth.uid()
    and couple_id = public.current_couple_id();

  if not found then
    raise exception 'personal_activity_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.get_calendar_activities(p_from date, p_to date)
returns table (
  id uuid,
  owner_id uuid,
  activity_date date,
  start_time time,
  end_time time,
  visibility text,
  color text,
  title text,
  description text,
  category text,
  location text,
  personal_notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    activity.id,
    activity.user_id,
    activity.activity_date,
    activity.start_time,
    activity.end_time,
    activity.visibility,
    case when activity.user_id = (select auth.uid()) or activity.visibility = 'shared'
      then details.color else '#A8A29E' end,
    case when activity.user_id = (select auth.uid()) or activity.visibility = 'shared' then details.title end,
    case when activity.user_id = (select auth.uid()) or activity.visibility = 'shared' then details.description end,
    case when activity.user_id = (select auth.uid()) or activity.visibility = 'shared' then details.category end,
    case when activity.user_id = (select auth.uid()) or activity.visibility = 'shared' then details.location end,
    case when activity.user_id = (select auth.uid()) then details.personal_notes end
  from public.personal_activities activity
  join public.personal_activity_details details on details.activity_id = activity.id
  where activity.couple_id = (select public.current_couple_id())
    and activity.activity_date between p_from and p_to
    and (
      activity.user_id = (select auth.uid())
      or (
        activity.visibility <> 'private'
        and exists (
          select 1 from public.couple_members member
          where member.couple_id = activity.couple_id
            and member.user_id = activity.user_id
        )
      )
    )
  order by activity.activity_date, activity.start_time;
$$;

revoke all on function public.bump_calendar_sync_state() from public, anon, authenticated;
revoke all on function public.bump_calendar_sync_for_membership() from public, anon, authenticated;
revoke all on function public.touch_activity_after_details_change() from public, anon, authenticated;
revoke all on function public.save_personal_activity(uuid, uuid, text, text, date, time, time, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.delete_personal_activity(uuid) from public, anon, authenticated;
revoke all on function public.get_calendar_activities(date, date) from public, anon, authenticated;
grant execute on function public.save_personal_activity(uuid, uuid, text, text, date, time, time, text, text, text, text, text)
  to authenticated;
grant execute on function public.delete_personal_activity(uuid) to authenticated;
grant execute on function public.get_calendar_activities(date, date) to authenticated;

alter publication supabase_realtime add table public.personal_activities;
alter publication supabase_realtime add table public.personal_day_notes;
alter publication supabase_realtime add table public.calendar_sync_state;
