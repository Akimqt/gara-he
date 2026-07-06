-- GARA-HE POS — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: uses `create table if not exists` / `drop policy if exists`.

-- ---------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------
create table if not exists menu_items (
  id text primary key,
  name text not null,
  category text not null,
  sizes jsonb not null default '[]'::jsonb,   -- [{ size: "16oz", price: 99 }, ...]
  best_seller boolean not null default false,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- categories (ordered list of tab names)
-- ---------------------------------------------------------------------
create table if not exists categories (
  name text primary key,
  position integer not null default 0
);

-- ---------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------
create table if not exists sales (
  id text primary key,
  "timestamp" bigint not null,               -- epoch ms, matches Date.now()
  lines jsonb not null default '[]'::jsonb,  -- CartLine[]
  subtotal numeric not null default 0,
  discount_pct numeric not null default 0,
  discount_amount numeric not null default 0,
  total numeric not null default 0,
  payment_method text not null,              -- 'cash' | 'gcash'
  cash_received numeric not null default 0,
  change numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sales_timestamp_idx on sales ("timestamp" desc);

-- ---------------------------------------------------------------------
-- settings (single row, id fixed at 1)
-- ---------------------------------------------------------------------
create table if not exists settings (
  id integer primary key default 1,
  senior_discount_pct numeric not null default 10,
  constraint settings_singleton check (id = 1)
);
insert into settings (id, senior_discount_pct)
values (1, 10)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- ledgers (one row per day: petty cash + expenses for that day)
-- ---------------------------------------------------------------------
create table if not exists ledgers (
  day text primary key,                      -- 'YYYY-MM-DD'
  petty_cash numeric not null default 0,
  expenses jsonb not null default '[]'::jsonb -- ExpenseEntry[]
);

-- =======================================================================
-- Row Level Security
-- =======================================================================
-- IMPORTANT: this app has no login screen. The policies below allow the
-- public "anon" key (the one shipped in your client bundle) to read AND
-- write every table. That's fine for a single-shop internal tool where
-- the URL isn't shared publicly, but anyone who does get the URL + anon
-- key could read or wipe your sales data. If that's a concern, add a PIN
-- gate in the app and/or Supabase Auth later — ask Claude to help when
-- you're ready.

alter table menu_items enable row level security;
alter table categories  enable row level security;
alter table sales       enable row level security;
alter table settings    enable row level security;
alter table ledgers     enable row level security;

drop policy if exists "anon full access" on menu_items;
create policy "anon full access" on menu_items for all using (true) with check (true);

drop policy if exists "anon full access" on categories;
create policy "anon full access" on categories for all using (true) with check (true);

drop policy if exists "anon full access" on sales;
create policy "anon full access" on sales for all using (true) with check (true);

drop policy if exists "anon full access" on settings;
create policy "anon full access" on settings for all using (true) with check (true);

drop policy if exists "anon full access" on ledgers;
create policy "anon full access" on ledgers for all using (true) with check (true);

-- =======================================================================
-- Realtime — lets multiple registers/devices see each other's changes live
-- =======================================================================
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table settings;
alter publication supabase_realtime add table ledgers;
