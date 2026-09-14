# 06 Data model

Postgres, via Supabase. Sketch rather than a migration, but the constraints are
the ones that matter and they are all deliberate.

## Schema

```sql
-- ---------------------------------------------------------------- people

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null,
  avatar_url    text,
  birth_year    int,                      -- year only, never a full date of birth
  age_band      text not null default 'unknown'
                check (age_band in ('under13','13_15','16_plus','unknown')),
  allow_random  boolean not null default false,
  discoverable  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- age_band is derived at signup and on each birthday by a job, and is the only
-- age fact any other table reads. Storing the year alone is enough to gate and
-- is materially less sensitive than a full date of birth.
-- allow_random is forced false for under13 by a trigger, not by the client.

-- friendships as an ordered pair, so a pair can never have two rows
create table friendships (
  user_low     uuid not null references profiles(id) on delete cascade,
  user_high    uuid not null references profiles(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  status       text not null check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

-- ---------------------------------------------------------------- content

create table packs (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique,
  title        text not null,
  subtitle     text,
  region       text,                      -- 'Arkansas', 'Ozarks', null = anywhere
  season       text check (season in ('spring','summer','fall','winter','any')),
  accent       text not null default 'trout_lily',
  author_id    uuid references profiles(id) on delete set null,
  source       text not null check (source in ('curated','generated','user')),
  visibility   text not null default 'private'
               check (visibility in ('private','unlisted','public')),
  review_state text not null default 'unreviewed'
               check (review_state in ('unreviewed','approved','rejected')),
  play_count   int not null default 0,
  created_at   timestamptz not null default now()
);

create table pack_items (
  id         uuid primary key default gen_random_uuid(),
  pack_id    uuid not null references packs(id) on delete cascade,
  label      text not null,               -- 'Trout Lily'
  hint       text,                         -- 'Mottled leaves, nodding yellow flower'
  emoji      text,
  item_key   text not null,                -- 'trout-lily', normalised, joins the Life List
  rarity     smallint not null default 3 check (rarity between 1 and 5),
  sort_order int not null default 0
);
create index on pack_items (pack_id);
create index on pack_items (item_key);

-- ---------------------------------------------------------------- games

create table games (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,      -- 6 chars, ambiguity-free alphabet
  title         text not null,
  pack_id       uuid not null references packs(id),
  host_id       uuid not null references profiles(id),
  seed          bigint not null,
  mode          text not null check (mode in ('honor','photo')),
  board_style   text not null default 'shuffled'
                check (board_style in ('shuffled','varied')),
  free_space    boolean not null default true,
  win_patterns  text[] not null default array['row','col','diag','stamp'],
  end_rule      text not null default 'first_bingo'
                check (end_rule in ('first_bingo','keep_playing','double','blackout')),
  audience      text not null default 'friends'
                check (audience in ('friends','random')),
  status        text not null default 'active'
                check (status in ('active','finished','abandoned')),
  started_at    timestamptz not null default now(),
  ends_at       timestamptz,
  finished_at   timestamptz,
  winner_ids    uuid[]                     -- an array, because ties are expected
);

create table game_players (
  game_id   uuid not null references games(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (game_id, player_id)
);

-- Boards are DERIVED from (game.seed, player_id) and are stored only as a
-- materialised convenience for server-side win checks and for opponent views.
-- A client never needs to fetch one; it regenerates it. This is what makes a
-- game joinable on a second device with no network round trip.
create table board_cells (
  game_id      uuid not null references games(id) on delete cascade,
  player_id    uuid not null references profiles(id) on delete cascade,
  idx          smallint not null check (idx between 0 and 24),
  pack_item_id uuid references pack_items(id),
  is_free      boolean not null default false,
  primary key (game_id, player_id, idx)
);

-- ---------------------------------------------------------------- play

-- Append-only. A mark is a fact, never an update. This is what makes offline
-- merging trivial: two devices recording the same mark is not a conflict.
create table marks (
  id             uuid primary key,          -- uuidv7, minted client-side
  game_id        uuid not null references games(id) on delete cascade,
  player_id      uuid not null references profiles(id) on delete cascade,
  idx            smallint not null check (idx between 0 and 24),

  client_ts      timestamptz not null,      -- bounded client time, see 05
  sync_anchor_id uuid,
  received_at    timestamptz not null default now(),
  effective_ts   timestamptz not null,      -- clamped server-side
  clamped        boolean not null default false,

  -- coarse, opt-in, never exposed to another player. Only ever compared
  -- server-side at 100m granularity for the Same Woods achievement.
  geohash5       text,

  undone_at      timestamptz,
  photo_id       uuid
);
create unique index marks_live on marks (game_id, player_id, idx)
  where undone_at is null;
create index on marks (game_id, effective_ts);

create table photos (
  id           uuid primary key,            -- minted client-side, so a queued
  mark_id      uuid not null references marks(id) on delete cascade,
                                            -- photo has an id before it uploads
  storage_path text,
  thumb_path   text,
  width int, height int, bytes int,
  taken_at     timestamptz,
  moderation   text not null default 'pending'
               check (moderation in ('pending','ok','flagged','removed')),
  full_res_until timestamptz,               -- 90 days past game end, null = keep
  uploaded_at  timestamptz
);

create table reactions (
  mark_id  uuid not null references marks(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  kind     text not null check (kind in ('heart','nice','suspicious')),
  primary key (mark_id, actor_id)
);

-- ---------------------------------------------------------------- records

-- The retention hook. Survives the deletion of the game that produced it.
create table life_list (
  user_id       uuid not null references profiles(id) on delete cascade,
  item_key      text not null,
  label         text not null,
  first_seen_at timestamptz not null,
  first_mark_id uuid,
  times_seen    int not null default 1,
  best_photo_id uuid,
  primary key (user_id, item_key)
);

create table achievements (
  key         text primary key,
  title       text not null,
  description text not null,
  emoji       text
);

create table user_achievements (
  user_id    uuid not null references profiles(id) on delete cascade,
  key        text not null references achievements(key),
  earned_at  timestamptz not null default now(),
  game_id    uuid references games(id) on delete set null,
  primary key (user_id, key)
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  subject_kind text not null check (subject_kind in ('photo','profile','pack','game')),
  subject_id  uuid not null,
  reason      text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
```

## Row Level Security, the two policies that matter

Everything else is routine owner checks. These two carry the product rules.

```sql
-- You may read any board cell in a game you are in. That is the whole
-- "see your opponent's board" feature, expressed once, at the database.
create policy read_boards_in_my_games on board_cells for select using (
  exists (select 1 from game_players gp
          where gp.game_id = board_cells.game_id
            and gp.player_id = auth.uid())
);

-- You may read a photo if you share a game with its author AND the photo has
-- cleared moderation OR it is your own. The moderation clause is what makes
-- random matchmaking safe to switch on later without touching client code.
create policy read_photos on photos for select using (
  exists (
    select 1 from marks m
    join game_players gp on gp.game_id = m.game_id and gp.player_id = auth.uid()
    where m.id = photos.mark_id
      and (m.player_id = auth.uid() or photos.moderation = 'ok')
  )
);
```

Marks are `insert` only for `auth.uid() = player_id`, with no `update` or
`delete` policy at all. Unmarking sets `undone_at` through a function, so the
append-only guarantee holds at the database rather than by convention.

## Win detection

Shared code, run on the client for the instant animation and on the server for
the authoritative result. Same function, same file, compiled for both.

```ts
export type Pattern = 'row' | 'col' | 'diag' | 'stamp';

const ROWS  = [0,1,2,3,4].map(r => [0,1,2,3,4].map(c => r*5 + c));
const COLS  = [0,1,2,3,4].map(c => [0,1,2,3,4].map(r => r*5 + c));
const DIAGS = [[0,6,12,18,24], [4,8,12,16,20]];
const STAMPS= [[0,1,5,6], [3,4,8,9], [15,16,20,21], [18,19,23,24]];

const LINES: Array<{ kind: Pattern; cells: number[] }> = [
  ...ROWS  .map(cells => ({ kind: 'row'   as const, cells })),
  ...COLS  .map(cells => ({ kind: 'col'   as const, cells })),
  ...DIAGS .map(cells => ({ kind: 'diag'  as const, cells })),
  ...STAMPS.map(cells => ({ kind: 'stamp' as const, cells })),
];

export function evaluate(
  marked: ReadonlySet<number>,
  patterns: readonly Pattern[],
  freeSpace: boolean,
) {
  const filled = freeSpace ? new Set([...marked, 12]) : marked;
  const complete: typeof LINES = [];
  const oneAway: number[] = [];

  for (const line of LINES) {
    if (!patterns.includes(line.kind)) continue;
    const missing = line.cells.filter(c => !filled.has(c));
    if (missing.length === 0) complete.push(line);
    else if (missing.length === 1) oneAway.push(missing[0]);
  }
  // oneAway drives the breathing highlight; keep it deduped, a square can be
  // the last one on more than one line at once
  return { complete, oneAway: [...new Set(oneAway)], won: complete.length > 0 };
}
```

The client runs this on every tap for the animation. The server runs it inside
the arbitration Edge Function against `effective_ts` ordering and writes
`games.winner_ids`. The client result is optimistic and can be corrected; in
practice it is corrected only in the offline near-tie case, and there the
correction is "you both won", which nobody objects to.

## The Life List write

One trigger, and it is the whole retention feature.

```sql
create or replace function bump_life_list() returns trigger as $$
begin
  insert into life_list (user_id, item_key, label, first_seen_at, first_mark_id)
  select new.player_id, pi.item_key, pi.label, new.effective_ts, new.id
    from board_cells bc
    join pack_items pi on pi.id = bc.pack_item_id
   where bc.game_id = new.game_id
     and bc.player_id = new.player_id
     and bc.idx = new.idx
  on conflict (user_id, item_key) do update
    set times_seen = life_list.times_seen + 1;
  return new;
end $$ language plpgsql;

create trigger marks_life_list after insert on marks
  for each row when (new.undone_at is null) execute function bump_life_list();
```

`item_key` is normalised on the pack item, not on the label, so "Trout Lily"
from a curated Arkansas pack and "Trout lily" from someone's generated list
land on the same life list row. Getting that normalisation right at pack
creation is worth more than any amount of fuzzy matching later.
