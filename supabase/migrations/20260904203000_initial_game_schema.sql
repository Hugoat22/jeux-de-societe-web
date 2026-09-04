-- Cendre MVP: canonical state stays server-only; clients receive per-player projections.
create extension if not exists pgcrypto;

create type public.game_status as enum ('lobby', 'running', 'paused', 'finished');
create type public.game_phase as enum (
  'lobby',
  'evacuation_draft',
  'dawn',
  'event_reveal',
  'collective_decision',
  'participant_selection',
  'private_decisions',
  'resolution',
  'night',
  'finished'
);
create type public.log_visibility as enum ('public', 'group', 'player', 'server');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9A-Z]{4}$'),
  status public.game_status not null default 'lobby',
  phase public.game_phase not null default 'lobby',
  day integer not null default 0 check (day >= 0),
  seed bigint not null,
  rng_cursor integer not null default 0 check (rng_cursor >= 0),
  version bigint not null default 1 check (version > 0),
  host_user_id uuid not null references auth.users(id) on delete restrict,
  phase_deadline timestamptz,
  content_version integer not null default 1,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  ready boolean not null default false,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_id, user_id)
);

alter table public.games
  add constraint games_host_player_membership_deferred
  foreign key (id, host_user_id)
  references public.players (game_id, user_id)
  deferrable initially deferred;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  health smallint not null default 100 check (health between 0 and 100),
  hunger smallint not null default 0 check (hunger between 0 and 100),
  thirst smallint not null default 0 check (thirst between 0 and 100),
  fatigue smallint not null default 0 check (fatigue between 0 and 100),
  morale smallint not null default 70 check (morale between 0 and 100),
  alive boolean not null default true,
  joined_day integer not null default 0,
  died_day integer,
  cause_of_death text,
  skills jsonb not null default '{}'::jsonb,
  private_traits jsonb not null default '[]'::jsonb,
  unique (game_id, player_id, joined_day)
);

create table public.character_traits (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  trait_key text not null,
  kind text not null check (kind in ('positive', 'negative', 'sequela')),
  is_private boolean not null default false,
  acquired_day integer not null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  condition_key text not null,
  severity smallint not null check (severity between 1 and 5),
  remaining_days integer not null check (remaining_days >= 0),
  stage text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  location_key text not null,
  status text not null default 'active' check (status in ('active', 'lost', 'merged')),
  created_day integer not null
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  joined_day integer not null,
  left_day integer,
  primary key (group_id, character_id, joined_day)
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  kind text not null check (kind in ('game', 'group', 'personal')),
  check (num_nonnulls(group_id, character_id) <= 1)
);

create table public.inventory_items (
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  item_key text not null,
  quantity integer not null default 0 check (quantity >= 0),
  condition smallint not null default 100 check (condition between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  primary key (inventory_id, item_key)
);

create table public.world_states (
  game_id uuid primary key references public.games(id) on delete cascade,
  weather text not null default 'ash',
  danger smallint not null default 1 check (danger between 0 and 100),
  flags jsonb not null default '{}'::jsonb,
  discovered_regions jsonb not null default '[]'::jsonb,
  known_groups jsonb not null default '[]'::jsonb,
  active_opportunities jsonb not null default '[]'::jsonb
);

create table public.event_instances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  definition_id text not null,
  group_id uuid references public.groups(id) on delete set null,
  day integer not null,
  status text not null check (status in ('revealed', 'deciding', 'resolved', 'cancelled')),
  public_payload jsonb not null default '{}'::jsonb,
  server_resolution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_instance_id uuid not null references public.event_instances(id) on delete cascade,
  scope text not null check (scope in ('collective', 'participants', 'private')),
  rule text not null check (rule in ('majority', 'host_breaks_tie', 'unanimous', 'individual')),
  deadline timestamptz,
  resolved_at timestamptz
);

create table public.votes (
  decision_id uuid not null references public.decisions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  option_key text not null,
  submitted_at timestamptz not null default now(),
  primary key (decision_id, player_id)
);

create table public.scheduled_effects (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  due_day_min integer not null,
  due_day_max integer not null,
  conditions jsonb not null default '[]'::jsonb,
  effects jsonb not null,
  resolved_at timestamptz,
  check (due_day_min <= due_day_max)
);

create table public.game_log (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  day integer not null,
  visibility public.log_visibility not null,
  group_id uuid references public.groups(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.processed_commands (
  game_id uuid not null references public.games(id) on delete cascade,
  command_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, command_id)
);

-- This is the only gameplay table readable from a phone. The server rewrites
-- one projection per authenticated user after every authoritative command.
create table public.game_views (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version bigint not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index players_user_game_idx on public.players (user_id, game_id);
create index events_game_day_idx on public.event_instances (game_id, day);
create index scheduled_effects_due_idx on public.scheduled_effects (game_id, due_day_min) where resolved_at is null;
create index game_log_game_id_idx on public.game_log (game_id, id desc);
create index game_views_user_idx on public.game_views (user_id, updated_at desc);

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.characters enable row level security;
alter table public.character_traits enable row level security;
alter table public.conditions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.world_states enable row level security;
alter table public.event_instances enable row level security;
alter table public.decisions enable row level security;
alter table public.votes enable row level security;
alter table public.scheduled_effects enable row level security;
alter table public.game_log enable row level security;
alter table public.processed_commands enable row level security;
alter table public.game_views enable row level security;

-- Canonical tables are server-only. service_role bypasses RLS.
revoke all on table
  public.games,
  public.players,
  public.characters,
  public.character_traits,
  public.conditions,
  public.groups,
  public.group_members,
  public.inventories,
  public.inventory_items,
  public.world_states,
  public.event_instances,
  public.decisions,
  public.votes,
  public.scheduled_effects,
  public.game_log,
  public.processed_commands
from anon, authenticated;

grant select on public.game_views to authenticated;
revoke insert, update, delete on public.game_views from anon, authenticated;

create policy "Players read only their own projection"
on public.game_views
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Postgres Changes is sufficient for the MVP volume. The client treats it as
-- an invalidation signal and then reloads its authorized projection.
do $$
begin
  alter publication supabase_realtime add table public.game_views;
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger game_views_set_updated_at
before update on public.game_views
for each row execute function public.set_updated_at();
