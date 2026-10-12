-- TapTimes schema for the serverless setup (Vercel + Supabase + GitHub Actions).
-- Safe to run on the existing database: every statement is idempotent and
-- only adds columns/tables/policies. Run it in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,
  url text not null,
  words text[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.articles add column if not exists summary text;
-- Stable id from the news source (e.g. Guardian content id) used for dedupe.
alter table public.articles add column if not exists external_id text;
alter table public.articles add column if not exists section text;
alter table public.articles add column if not exists published_at timestamptz;

create unique index if not exists articles_external_id_key on public.articles (external_id);
create index if not exists articles_expires_at_idx on public.articles (expires_at);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  email text,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists username text;
alter table public.users add column if not exists email text;

create table if not exists public.typing_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text,
  article_title text,
  wpm integer not null,
  accuracy integer not null,
  time integer not null,
  completed_at timestamptz not null default now()
);

alter table public.typing_tests
  add column if not exists article_id uuid references public.articles (id) on delete set null;
alter table public.typing_tests add column if not exists corrected_errors integer;
alter table public.typing_tests add column if not exists uncorrected_errors integer;

create index if not exists typing_tests_user_idx on public.typing_tests (user_id, completed_at desc);

create table if not exists public.user_article_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The browser uses the anon key; these policies are the only access control.
-- The nightly ingest job uses the service-role key, which bypasses RLS.
-- Existing policies on these tables are dropped first so no old, overly
-- permissive policy (e.g. "users readable by everyone") survives.
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('articles', 'users', 'typing_tests', 'user_article_views')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.articles enable row level security;
alter table public.users enable row level security;
alter table public.typing_tests enable row level security;
alter table public.user_article_views enable row level security;

create policy "articles are readable by everyone"
  on public.articles for select to anon, authenticated using (true);

create policy "users read own profile"
  on public.users for select to authenticated using (id = auth.uid());
create policy "users update own profile"
  on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read own tests"
  on public.typing_tests for select to authenticated using (user_id = auth.uid());
create policy "insert own tests"
  on public.typing_tests for insert to authenticated with check (user_id = auth.uid());

create policy "read own views"
  on public.user_article_views for select to authenticated using (user_id = auth.uid());
create policy "insert own views"
  on public.user_article_views for insert to authenticated with check (user_id = auth.uid());
create policy "update own views"
  on public.user_article_views for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profile row is created by the database when someone signs up, so it works
-- even when email confirmation means the browser has no session yet.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired text := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1));
begin
  begin
    insert into public.users (id, username, email)
    values (new.id, desired, new.email)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Username taken (race with another sign-up): keep it unique with a suffix.
    insert into public.users (id, username, email)
    values (new.id, desired || '_' || left(new.id::text, 6), new.email)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form check a username without exposing the users table.
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.users where lower(username) = lower(name));
$$;

-- ---------------------------------------------------------------------------
-- Article picker
-- Returns one random unexpired article the caller hasn't seen.
--   exclude      ids the client already showed (used for logged-out users)
--   include_seen when true, ignore seen-tracking (the "repeat one" fallback)
-- Runs as the caller, so RLS on user_article_views applies.
-- ---------------------------------------------------------------------------

create or replace function public.get_next_article(
  exclude uuid[] default '{}',
  include_seen boolean default false
)
returns setof public.articles
language sql
stable
set search_path = public
as $$
  select a.*
  from public.articles a
  where a.expires_at > now()
    and (
      include_seen
      or (
        not (a.id = any (coalesce(exclude, '{}')))
        and not exists (
          select 1 from public.user_article_views v
          where v.user_id = auth.uid() and v.article_id = a.id
        )
      )
    )
  order by random()
  limit 1;
$$;

grant execute on function public.get_next_article(uuid[], boolean) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
