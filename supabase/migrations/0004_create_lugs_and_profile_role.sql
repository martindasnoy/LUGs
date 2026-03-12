create extension if not exists pgcrypto;

create table if not exists public.lugs (
  lug_id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pais text,
  descripcion text,
  color1 text,
  color2 text,
  color3 text,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists rol_lug text;
