-- Réplica mínima del entorno de Supabase para probar migraciones y RLS en PGlite.
-- No se usa en producción: Supabase ya proporciona todo esto.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema storage;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- Supabase concede por defecto todos los privilegios en public a estos roles;
-- las migraciones deben restringirlos explícitamente.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant execute on function auth.uid() to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid default auth.uid()
);

alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;

create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;
