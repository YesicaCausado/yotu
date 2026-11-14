-- Fase 2: citas y planes compartidos por pareja.

create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples (id) on delete cascade,
  request_key  uuid not null,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  title        text not null check (char_length(btrim(title)) between 1 and 100),
  description  text check (description is null or char_length(description) <= 3000),
  date         date not null,
  start_time   time not null,
  end_time     time,
  location     text check (location is null or char_length(location) <= 200),
  category     text not null check (category in ('romantica', 'comida', 'paseo', 'cine', 'viaje', 'celebracion', 'otra')),
  image_path   text check (image_path is null or char_length(image_path) <= 400),
  budget       numeric(10, 2) check (budget is null or budget >= 0),
  notes        text check (notes is null or char_length(notes) <= 3000),
  status       text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint appointments_time_order check (end_time is null or end_time > start_time),
  constraint appointments_idempotency unique (couple_id, request_key)
);

create index appointments_couple_date_idx on public.appointments (couple_id, date, start_time);
create index appointments_couple_status_idx on public.appointments (couple_id, status);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant insert (couple_id, request_key, title, description, date, start_time, end_time, location, category, image_path, budget, notes, status)
  on public.appointments to authenticated;
grant update (title, description, date, start_time, end_time, location, category, image_path, budget, notes, status)
  on public.appointments to authenticated;
grant delete on public.appointments to authenticated;

create policy appointments_select on public.appointments for select to authenticated
  using (couple_id = (select public.current_couple_id()));
create policy appointments_insert on public.appointments for insert to authenticated
  with check (
    couple_id = (select public.current_couple_id())
    and created_by = (select auth.uid())
  );
create policy appointments_update on public.appointments for update to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));
create policy appointments_delete on public.appointments for delete to authenticated
  using (couple_id = (select public.current_couple_id()));

-- La tabla se incluye en Realtime para que la pareja reciba cambios al instante.
alter publication supabase_realtime add table public.appointments;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('appointment-covers', 'appointment-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy appointment_covers_select on storage.objects for select to authenticated
  using (bucket_id = 'appointment-covers' and (storage.foldername(name))[1] = (select public.current_couple_id())::text);
create policy appointment_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'appointment-covers' and (storage.foldername(name))[1] = (select public.current_couple_id())::text);
create policy appointment_covers_update on storage.objects for update to authenticated
  using (bucket_id = 'appointment-covers' and (storage.foldername(name))[1] = (select public.current_couple_id())::text)
  with check (bucket_id = 'appointment-covers' and (storage.foldername(name))[1] = (select public.current_couple_id())::text);
create policy appointment_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'appointment-covers' and (storage.foldername(name))[1] = (select public.current_couple_id())::text);
