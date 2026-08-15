-- ============================================================================
-- LA FLAMME — Schéma fidélité / comptes clients
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller ce
-- fichier en entier → Run. Peut être relancé sans risque : le bloc du haut
-- supprime proprement toute version précédente (tables + policies +
-- fonctions + trigger) avant de tout recréer — pratique si un essai
-- précédent a laissé une table "profiles" partielle.
--
-- ⚠️ Si profiles/point_transactions contiennent déjà de vraies données
-- clients, ce reset les efface. Sur une base flambant neuve, sans souci.
--
-- Principe anti-triche : un client ne peut jamais modifier ses propres points
-- ni son statut. Seul un compte marqué is_staff peut créditer des points, et
-- toujours via une ligne dans point_transactions (jamais en écrivant
-- directement profiles.points) — ça garde un historique complet et vérifiable
-- de qui a crédité quoi, et quand.
-- ============================================================================

-- ---- reset propre (sans risque si les tables n'existent pas encore) -------
drop table if exists public.point_transactions cascade;
drop table if exists public.stamp_events cascade;
drop table if exists public.profiles cascade;
drop function if exists public.protect_profile_fields() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.apply_point_transaction() cascade;
drop function if exists public.apply_stamp_event() cascade;

-- ---- profils : un par utilisateur inscrit, créé automatiquement ------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  points integer not null default 0,
  -- Carte de fidélité pizza/burger : 1 tampon par achat, 9 tampons =
  -- le 10ème est offert (compteur remis à 0 à ce moment-là — voir
  -- apply_stamp_event plus bas). Même protection anti-triche que points :
  -- jamais modifiable directement par le client, uniquement via
  -- stamp_events (staff only).
  pizza_burger_count integer not null default 0,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_staff"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff));

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Bloque la modification de points/is_staff/referral_code par le client
-- lui-même, même s'il passe par la policy update ci-dessus — seule une
-- fonction staff (voir apply_point_transaction plus bas) peut y toucher.
--
-- auth.uid() est NULL quand la requête ne vient pas d'une vraie session
-- client (PostgREST) — c'est le cas du Table Editor et du SQL Editor de
-- Supabase, utilisés uniquement par vous. On ne bloque donc que les
-- vraies requêtes clients (auth.uid() renseigné) : un client connecté ne
-- peut jamais se rendre staff lui-même, mais votre édition manuelle dans
-- le dashboard, elle, passe — c'est ce qui permet le tout premier
-- bascule de is_staff à true.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not coalesce((select is_staff from public.profiles where id = auth.uid()), false) then
    new.points := old.points;
    new.pizza_burger_count := old.pizza_burger_count;
    new.is_staff := old.is_staff;
    new.referral_code := old.referral_code;
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Crée le profil + un code de parrainage à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, upper(substr(md5(random()::text || new.id::text), 1, 6)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- transactions de points : registre, écriture réservée au staff --------
create table public.point_transactions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id),
  amount integer not null,
  reason text not null,
  order_amount_cents integer,
  credited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.point_transactions enable row level security;

create policy "transactions_select_own"
  on public.point_transactions for select
  using (auth.uid() = profile_id);

create policy "transactions_select_staff"
  on public.point_transactions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff));

create policy "transactions_insert_staff_only"
  on public.point_transactions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff));

-- Répercute chaque transaction sur le solde du profil concerné
create or replace function public.apply_point_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set points = points + new.amount where id = new.profile_id;
  return new;
end;
$$;

create trigger apply_point_transaction_trigger
  after insert on public.point_transactions
  for each row execute function public.apply_point_transaction();

-- ---- carte de fidélité pizza/burger : 9 tampons = 10ème offert ------------
-- Même principe que point_transactions : un registre append-only,
-- écriture réservée au staff, et une fonction security definer qui fait
-- le calcul — jamais d'UPDATE direct sur profiles.pizza_burger_count
-- depuis le client, donc rien à trafiquer.
create table public.stamp_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id),
  category text not null default 'pizza_burger',
  credited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.stamp_events enable row level security;

create policy "stamp_events_select_own"
  on public.stamp_events for select
  using (auth.uid() = profile_id);

create policy "stamp_events_select_staff"
  on public.stamp_events for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff));

create policy "stamp_events_insert_staff_only"
  on public.stamp_events for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff));

-- Incrémente le compteur ; au 10ème tampon (count était à 9), remet à 0
-- au lieu de continuer à monter — c'est ce comptage qui matérialise
-- "achetez-en 9, le 10ème est offert".
create or replace function public.apply_stamp_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  select pizza_burger_count into current_count from public.profiles where id = new.profile_id;
  if current_count >= 9 then
    update public.profiles set pizza_burger_count = 0 where id = new.profile_id;
  else
    update public.profiles set pizza_burger_count = current_count + 1 where id = new.profile_id;
  end if;
  return new;
end;
$$;

create trigger apply_stamp_event_trigger
  after insert on public.stamp_events
  for each row execute function public.apply_stamp_event();

-- ============================================================================
-- Étape suivante (à faire une seule fois, à la main, dans Supabase) :
-- 1. Inscrivez-vous sur compte.html avec l'e-mail du restaurant.
-- 2. Dashboard → Table Editor → profiles → trouvez cette ligne → passez
--    is_staff à true. C'est ce qui débloque l'accès à staff.html.
-- ============================================================================
