-- LTD Sandy Shores — stockage simple d'un état JSON partagé.
-- À exécuter dans Supabase > SQL Editor si tu actives le mode cloud.

create table if not exists public.ltd_compta_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ltd_compta_state enable row level security;

-- Usage RP : lecture/écriture via clé anon du site statique.
-- Pour de vraies données sensibles, remplace cette politique par une authentification Supabase.
drop policy if exists "ltd_compta_read" on public.ltd_compta_state;
create policy "ltd_compta_read" on public.ltd_compta_state for select to anon using (true);

drop policy if exists "ltd_compta_write" on public.ltd_compta_state;
create policy "ltd_compta_write" on public.ltd_compta_state for insert to anon with check (true);

drop policy if exists "ltd_compta_update" on public.ltd_compta_state;
create policy "ltd_compta_update" on public.ltd_compta_state for update to anon using (true) with check (true);
