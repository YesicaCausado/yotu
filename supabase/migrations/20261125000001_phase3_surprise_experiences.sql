-- Citas sorpresa: la fila compartida contiene solo el estado pendiente.
-- Los detalles y las portadas se revelan mediante RLS cuando llega reveal_at.

alter table public.appointments
  add column is_surprise boolean not null default false,
  add column reveal_at timestamptz,
  add column starts_at timestamptz;

alter table public.appointments
  add constraint appointments_surprise_reveal_check
  check ((is_surprise and reveal_at is not null) or (not is_surprise and reveal_at is null));

create function public.set_appointment_starts_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  select timezone into v_timezone from public.couples where id = new.couple_id;
  if v_timezone is null then
    raise exception 'couple_not_found' using errcode = 'P0001';
  end if;
  new.starts_at := (new.date + new.start_time) at time zone v_timezone;
  return new;
end;
$$;

create trigger appointments_starts_at
  before insert or update of couple_id, date, start_time on public.appointments
  for each row execute function public.set_appointment_starts_at();

update public.appointments appointment
set starts_at = (appointment.date + appointment.start_time) at time zone couple.timezone
from public.couples couple
where couple.id = appointment.couple_id;
alter table public.appointments alter column starts_at set not null;

create table public.appointment_surprise_details (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 3000),
  appointment_date date not null,
  appointment_start_time time not null,
  appointment_end_time time,
  starts_at timestamptz not null,
  location text check (location is null or char_length(location) <= 200),
  category text not null check (category in ('romantica', 'comida', 'paseo', 'cine', 'viaje', 'celebracion', 'otra')),
  image_path text check (image_path is null or char_length(image_path) <= 400),
  notes text check (notes is null or char_length(notes) <= 3000),
  constraint appointment_surprise_details_time_order
    check (appointment_end_time is null or appointment_end_time > appointment_start_time)
);

create table public.appointment_surprise_notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in (
    'surprise_received', 'surprise_revealed', 'date_approaching', 'date_started'
  )),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint appointment_surprise_notification_once unique (appointment_id, recipient_id, event_type)
);

create index appointment_surprise_notifications_recipient_idx
  on public.appointment_surprise_notifications (recipient_id, created_at desc);

alter table public.appointment_surprise_details enable row level security;
alter table public.appointment_surprise_notifications enable row level security;
revoke all on public.appointment_surprise_details, public.appointment_surprise_notifications
  from anon, authenticated;
grant select on public.appointment_surprise_details, public.appointment_surprise_notifications
  to authenticated;
grant update (seen_at) on public.appointment_surprise_notifications to authenticated;

create policy appointment_surprise_details_select on public.appointment_surprise_details
  for select to authenticated using (
    couple_id = (select public.current_couple_id())
    and public.is_couple_member(couple_id)
    and exists (
      select 1 from public.appointments appointment
      where appointment.id = appointment_surprise_details.appointment_id
        and appointment.couple_id = appointment_surprise_details.couple_id
        and (appointment.created_by = (select auth.uid()) or appointment.reveal_at <= now())
    )
  );

create policy appointment_surprise_notifications_select on public.appointment_surprise_notifications
  for select to authenticated using (
    recipient_id = (select auth.uid())
    and couple_id = (select public.current_couple_id())
    and public.is_couple_member(couple_id)
  );
create policy appointment_surprise_notifications_mark_seen on public.appointment_surprise_notifications
  for update to authenticated using (
    recipient_id = (select auth.uid()) and couple_id = (select public.current_couple_id())
  ) with check (
    recipient_id = (select auth.uid()) and couple_id = (select public.current_couple_id())
  );

drop policy appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
  using (couple_id = (select public.current_couple_id()) and not is_surprise)
  with check (couple_id = (select public.current_couple_id()) and not is_surprise);

drop policy appointments_delete on public.appointments;
create policy appointments_delete on public.appointments for delete to authenticated
  using (
    couple_id = (select public.current_couple_id())
    and (not is_surprise or created_by = (select auth.uid()))
  );

create function public.notify_surprise_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_surprise then
    insert into public.appointment_surprise_notifications (
      couple_id, appointment_id, recipient_id, actor_id, event_type
    )
    select new.couple_id, new.id, member.user_id, new.created_by, 'surprise_received'
    from public.couple_members member
    where member.couple_id = new.couple_id
      and member.user_id <> new.created_by
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger appointment_surprise_created
  after insert on public.appointments
  for each row execute function public.notify_surprise_created();

create function public.create_or_update_surprise_appointment(
  p_appointment_id uuid,
  p_request_key uuid,
  p_title text,
  p_description text,
  p_appointment_date date,
  p_appointment_start_time time,
  p_appointment_end_time time,
  p_reveal_at timestamptz,
  p_location text,
  p_category text,
  p_image_path text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_timezone text;
  v_appointment_id uuid;
  v_existing_created_by uuid;
  v_existing_is_surprise boolean;
  v_existing_reveal_at timestamptz;
  v_starts_at timestamptz;
  v_shell_date date;
  v_shell_time time;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if v_couple_id is null or p_request_key is null
    or p_title is null or char_length(btrim(p_title)) not between 1 and 100
    or (p_description is not null and char_length(p_description) > 3000)
    or p_appointment_date is null or p_appointment_start_time is null
    or (p_appointment_end_time is not null and p_appointment_end_time <= p_appointment_start_time)
    or p_reveal_at is null or p_reveal_at <= now()
    or (p_location is not null and char_length(p_location) > 200)
    or p_category is null or p_category not in ('romantica', 'comida', 'paseo', 'cine', 'viaje', 'celebracion', 'otra')
    or (p_notes is not null and char_length(p_notes) > 3000)
  then
    raise exception 'invalid_surprise_appointment' using errcode = 'P0001';
  end if;

  select timezone into v_timezone
  from public.couples
  where id = v_couple_id
    and exists (
      select 1 from public.couple_members
      where couple_id = v_couple_id and user_id = v_user_id
    );
  if v_timezone is null then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;

  v_starts_at := (p_appointment_date + p_appointment_start_time) at time zone v_timezone;
  if p_reveal_at > v_starts_at then
    raise exception 'reveal_after_appointment' using errcode = 'P0001';
  end if;

  if p_image_path is not null and (
    char_length(p_image_path) > 400
    or p_image_path !~ (
      '^' || v_couple_id::text || '/' || v_user_id::text
      || '/surprise-cover-[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  ) then
    raise exception 'invalid_surprise_image' using errcode = 'P0001';
  end if;

  if p_appointment_id is null then
    select id, created_by, is_surprise, reveal_at
    into v_appointment_id, v_existing_created_by, v_existing_is_surprise, v_existing_reveal_at
    from public.appointments
    where couple_id = v_couple_id and request_key = p_request_key;
    if v_appointment_id is not null then
      if v_existing_created_by <> v_user_id or not v_existing_is_surprise or v_existing_reveal_at <= now() then
        raise exception 'surprise_request_key_conflict' using errcode = 'P0001';
      end if;
    else
      v_shell_date := (p_reveal_at at time zone v_timezone)::date;
      v_shell_time := (p_reveal_at at time zone v_timezone)::time;
      insert into public.appointments (
        couple_id, request_key, created_by, title, date, start_time, category,
        is_surprise, reveal_at, budget_mode, budget_currency
      ) values (
        v_couple_id, p_request_key, v_user_id, 'Sorpresa pendiente',
        v_shell_date, v_shell_time, 'otra', true, p_reveal_at, 'invites', 'COP'
      )
      returning id into v_appointment_id;
    end if;

    v_shell_date := (p_reveal_at at time zone v_timezone)::date;
    v_shell_time := (p_reveal_at at time zone v_timezone)::time;
    update public.appointments
    set date = v_shell_date, start_time = v_shell_time, reveal_at = p_reveal_at
    where id = v_appointment_id;
  else
    select id into v_appointment_id
    from public.appointments
    where id = p_appointment_id
      and couple_id = v_couple_id
      and created_by = v_user_id
      and is_surprise
      and reveal_at > now()
    for update;
    if v_appointment_id is null then
      raise exception 'surprise_not_found_or_revealed' using errcode = 'P0001';
    end if;

    v_shell_date := (p_reveal_at at time zone v_timezone)::date;
    v_shell_time := (p_reveal_at at time zone v_timezone)::time;
    update public.appointments
    set date = v_shell_date, start_time = v_shell_time, reveal_at = p_reveal_at
    where id = v_appointment_id;
  end if;

  insert into public.appointment_surprise_details (
    appointment_id, couple_id, title, description, appointment_date,
    appointment_start_time, appointment_end_time, starts_at, location, category, image_path, notes
  ) values (
    v_appointment_id, v_couple_id, btrim(p_title), nullif(btrim(p_description), ''),
    p_appointment_date, p_appointment_start_time, p_appointment_end_time, v_starts_at,
    nullif(btrim(p_location), ''), p_category, p_image_path, nullif(btrim(p_notes), '')
  )
  on conflict (appointment_id) do update set
    title = excluded.title,
    description = excluded.description,
    appointment_date = excluded.appointment_date,
    appointment_start_time = excluded.appointment_start_time,
    appointment_end_time = excluded.appointment_end_time,
    starts_at = excluded.starts_at,
    location = excluded.location,
    category = excluded.category,
    image_path = excluded.image_path,
    notes = excluded.notes;

  return v_appointment_id;
end;
$$;

create function public.sync_appointment_surprise_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
begin
  if v_user_id is null or v_couple_id is null then
    raise exception 'not_authenticated_or_in_couple' using errcode = 'P0001';
  end if;
  if not public.is_couple_member(v_couple_id) then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;

  insert into public.appointment_surprise_notifications (
    couple_id, appointment_id, recipient_id, actor_id, event_type
  )
  select appointment.couple_id, appointment.id, member.user_id, appointment.created_by, event.event_type
  from public.appointments appointment
  left join public.appointment_surprise_details details on details.appointment_id = appointment.id
  join public.couple_members member on member.couple_id = appointment.couple_id
  cross join lateral (
    values
      ('surprise_revealed'::text, appointment.is_surprise and appointment.reveal_at <= now()),
      ('date_approaching'::text, coalesce(details.starts_at, appointment.starts_at) > now()
        and coalesce(details.starts_at, appointment.starts_at) <= now() + interval '24 hours'),
      ('date_started'::text, coalesce(details.starts_at, appointment.starts_at) <= now()
        and coalesce(details.starts_at, appointment.starts_at) > now() - interval '24 hours')
  ) event(event_type, is_due)
  where appointment.couple_id = v_couple_id
    and appointment.status = 'planned'
    and event.is_due
  on conflict do nothing;
end;
$$;

create function public.can_access_surprise_cover(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(p_path, '/', 1) = public.current_couple_id()::text
    and (
      split_part(p_path, '/', 2) = auth.uid()::text
      or exists (
        select 1
        from public.appointment_surprise_details details
        join public.appointments appointment on appointment.id = details.appointment_id
        where details.image_path = p_path
          and details.couple_id = public.current_couple_id()
          and appointment.reveal_at <= now()
      )
    );
$$;

revoke all on function public.set_appointment_starts_at() from public, anon, authenticated;
revoke all on function public.notify_surprise_created() from public, anon, authenticated;
revoke all on function public.create_or_update_surprise_appointment(uuid, uuid, text, text, date, time, time, timestamptz, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.sync_appointment_surprise_notifications() from public, anon, authenticated;
revoke all on function public.can_access_surprise_cover(text) from public, anon, authenticated;
grant execute on function public.create_or_update_surprise_appointment(uuid, uuid, text, text, date, time, time, timestamptz, text, text, text, text)
  to authenticated;
grant execute on function public.sync_appointment_surprise_notifications() to authenticated;
grant execute on function public.can_access_surprise_cover(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('surprise-covers', 'surprise-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy surprise_covers_select on storage.objects for select to authenticated
  using (bucket_id = 'surprise-covers' and public.can_access_surprise_cover(name));
create policy surprise_covers_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'surprise-covers'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy surprise_covers_update on storage.objects for update to authenticated
  using (
    bucket_id = 'surprise-covers'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'surprise-covers'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy surprise_covers_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'surprise-covers'
    and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

alter publication supabase_realtime add table public.appointment_surprise_notifications;
