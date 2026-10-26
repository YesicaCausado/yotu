-- =============================================================================
-- Fase 1: perfiles, parejas, miembros e invitaciones
--
-- Principios:
--   * RLS activada en todas las tablas; los permisos se conceden explícitamente.
--   * Las operaciones delicadas (crear pareja, invitar, aceptar, salir) solo se
--     hacen mediante funciones SECURITY DEFINER que validan todo atómicamente.
--   * El cliente nunca decide a qué pareja pertenece: se deduce de auth.uid().
--   * Los tokens de invitación nunca se guardan en claro, solo su SHA-256.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_path  text check (avatar_path is null or char_length(avatar_path) <= 300),
  birthday     date,
  timezone     text not null default 'UTC' check (public.is_valid_timezone(timezone)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.couples (
  id               uuid primary key default gen_random_uuid(),
  name             text check (name is null or char_length(btrim(name)) between 1 and 80),
  anniversary_date date,
  timezone         text not null default 'UTC' check (public.is_valid_timezone(timezone)),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- user_id UNIQUE: una persona solo puede pertenecer a una pareja.
create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id   uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table public.couple_invitations (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  token_hash  text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at  timestamptz
);

create index couple_invitations_couple_idx on public.couple_invitations (couple_id);
create index couple_invitations_created_by_idx on public.couple_invitations (created_by, created_at);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger couples_updated_at before update on public.couples
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Máximo dos miembros por pareja (bloquea la fila de la pareja para evitar
-- carreras entre dos aceptaciones simultáneas).
-- -----------------------------------------------------------------------------

create or replace function public.enforce_couple_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger couple_members_capacity before insert on public.couple_members
  for each row execute function public.enforce_couple_capacity();

-- -----------------------------------------------------------------------------
-- Perfil automático al registrarse
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_tz   text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
begin
  if v_name = '' then
    v_name := split_part(coalesce(new.email, 'Yo'), '@', 1);
  end if;
  if not public.is_valid_timezone(v_tz) then
    v_tz := 'UTC';
  end if;
  insert into public.profiles (id, display_name, timezone)
  values (new.id, left(v_name, 60), v_tz);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Funciones auxiliares para RLS (SECURITY DEFINER para evitar recursión)
-- -----------------------------------------------------------------------------

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.couple_members where user_id = auth.uid();
$$;

create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = auth.uid()
  );
$$;

-- ¿Es p_user_id el propio usuario o su pareja? Acepta texto para poder usarse
-- con rutas de Storage sin fallar al convertir a uuid.
create or replace function public.is_self_or_partner(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    auth.uid()::text = p_user_id
    or exists (
      select 1
      from public.couple_members me
      join public.couple_members other on other.couple_id = me.couple_id
      where me.user_id = auth.uid() and other.user_id::text = p_user_id
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS y permisos
-- -----------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.couples            enable row level security;
alter table public.couple_members     enable row level security;
alter table public.couple_invitations enable row level security;

revoke all on public.profiles, public.couples, public.couple_members, public.couple_invitations
  from anon, authenticated;

-- profiles: leer el propio y el de la pareja; editar solo el propio y solo
-- columnas permitidas.
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path, birthday, timezone) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (public.is_self_or_partner(id::text));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- couples: miembros leen y editan datos básicos; crear/borrar solo por RPC.
grant select on public.couples to authenticated;
grant update (name, anniversary_date, timezone) on public.couples to authenticated;

create policy couples_select on public.couples for select to authenticated
  using (public.is_couple_member(id));
create policy couples_update on public.couples for update to authenticated
  using (public.is_couple_member(id))
  with check (public.is_couple_member(id));

-- couple_members: solo lectura para miembros; cambios solo por RPC.
grant select on public.couple_members to authenticated;

create policy couple_members_select on public.couple_members for select to authenticated
  using (public.is_couple_member(couple_id));

-- couple_invitations: los miembros ven el historial, pero nunca el hash.
grant select (id, couple_id, created_by, created_at, expires_at, accepted_by, accepted_at, revoked_at)
  on public.couple_invitations to authenticated;

create policy couple_invitations_select on public.couple_invitations for select to authenticated
  using (public.is_couple_member(couple_id));

-- -----------------------------------------------------------------------------
-- RPC
-- Errores: se lanzan con errcode P0001 y un código legible en el mensaje
-- (not_authenticated, already_in_couple, ...) que la app traduce.
-- -----------------------------------------------------------------------------

create or replace function public.create_couple(
  p_name text default null,
  p_anniversary_date date default null,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception 'already_in_couple' using errcode = 'P0001';
  end if;

  insert into public.couples (name, anniversary_date, timezone, created_by)
  values (
    nullif(btrim(p_name), ''),
    p_anniversary_date,
    case when public.is_valid_timezone(p_timezone) then p_timezone else 'UTC' end,
    v_uid
  )
  returning id into v_couple_id;

  insert into public.couple_members (couple_id, user_id) values (v_couple_id, v_uid);
  return v_couple_id;
end;
$$;

-- Devuelve el token en claro UNA sola vez; en la base solo queda su hash.
create or replace function public.create_invitation()
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple_id uuid;
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select cm.couple_id into v_couple_id from public.couple_members cm where cm.user_id = v_uid;
  if v_couple_id is null then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members cm where cm.couple_id = v_couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_invitations ci
      where ci.created_by = v_uid and ci.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Solo una invitación activa por pareja.
  update public.couple_invitations ci
     set revoked_at = now()
   where ci.couple_id = v_couple_id and ci.accepted_at is null and ci.revoked_at is null;

  -- 2 × gen_random_uuid() (generador criptográfico) ≈ 244 bits aleatorios.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.couple_invitations (couple_id, token_hash, created_by, expires_at)
  values (v_couple_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid, v_expires);

  return query select v_token, v_expires;
end;
$$;

-- Vista previa de una invitación para quien tiene el enlace.
create or replace function public.get_invitation_preview(p_token text)
returns table (status text, inviter_name text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.couple_invitations;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.couple_invitations ci
   where ci.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz;
    return;
  end if;

  return query
    select
      case
        when v_inv.revoked_at is not null then 'revoked'
        when v_inv.accepted_at is not null then 'used'
        when v_inv.expires_at <= now() then 'expired'
        when v_inv.created_by = auth.uid() then 'own'
        when exists (select 1 from public.couple_members cm where cm.user_id = auth.uid()) then 'already_in_couple'
        when (select count(*) from public.couple_members cm where cm.couple_id = v_inv.couple_id) >= 2 then 'couple_full'
        else 'valid'
      end,
      (select p.display_name from public.profiles p where p.id = v_inv.created_by),
      v_inv.expires_at;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.couple_invitations;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.couple_invitations ci
   where ci.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
   for update;

  if not found then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  elsif v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  elsif v_inv.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  elsif v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  elsif v_inv.created_by = v_uid then
    raise exception 'own_invitation' using errcode = 'P0001';
  elsif exists (select 1 from public.couple_members cm where cm.user_id = v_uid) then
    raise exception 'already_in_couple' using errcode = 'P0001';
  end if;

  -- El trigger de capacidad lanza couple_full si ya hay dos miembros.
  insert into public.couple_members (couple_id, user_id) values (v_inv.couple_id, v_uid);

  update public.couple_invitations ci
     set accepted_by = v_uid, accepted_at = now()
   where ci.id = v_inv.id;

  return v_inv.couple_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.couple_invitations ci
     set revoked_at = now()
   where ci.id = p_invitation_id
     and ci.accepted_at is null
     and ci.revoked_at is null
     and public.is_couple_member(ci.couple_id);

  if not found then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;
end;
$$;

-- Salir de la pareja: la persona pierde el acceso; los datos compartidos quedan
-- con quien permanece. Si no queda nadie, la pareja (y sus datos) se elimina.
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  delete from public.couple_members cm where cm.user_id = v_uid
  returning cm.couple_id into v_couple_id;

  if v_couple_id is null then
    raise exception 'not_in_couple' using errcode = 'P0001';
  end if;

  update public.couple_invitations ci
     set revoked_at = now()
   where ci.couple_id = v_couple_id and ci.accepted_at is null and ci.revoked_at is null;

  if not exists (select 1 from public.couple_members cm where cm.couple_id = v_couple_id) then
    delete from public.couples c where c.id = v_couple_id;
  end if;
end;
$$;

-- Permisos de ejecución: nada para anon; las funciones internas no se exponen.
revoke execute on function
  public.is_valid_timezone(text),
  public.set_updated_at(),
  public.enforce_couple_capacity(),
  public.handle_new_user(),
  public.current_couple_id(),
  public.is_couple_member(uuid),
  public.is_self_or_partner(text),
  public.create_couple(text, date, text),
  public.create_invitation(),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.leave_couple()
from public, anon;

grant execute on function
  public.is_valid_timezone(text),
  public.current_couple_id(),
  public.is_couple_member(uuid),
  public.is_self_or_partner(text),
  public.create_couple(text, date, text),
  public.create_invitation(),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.leave_couple()
to authenticated;

revoke execute on function public.set_updated_at(), public.enforce_couple_capacity(), public.handle_new_user()
  from authenticated;

-- -----------------------------------------------------------------------------
-- Storage: avatares en bucket privado, ruta {user_id}/{archivo}
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_self_or_partner((storage.foldername(name))[1]));

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
