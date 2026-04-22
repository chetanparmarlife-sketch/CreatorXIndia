-- ============================================================================
-- CreatorX — Supabase migration
--
-- Mirrors shared/schema.ts exactly. Run this in a clean Supabase project via
-- the SQL editor or `supabase db push`. Idempotent: safe to re-run.
-- ============================================================================

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums --------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('creator','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type campaign_status as enum ('draft','open','closed','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending','accepted','rejected','withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deliverable_status as enum ('pending','submitted','revision','approved','live','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('earning','withdrawal','bonus','adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status as enum ('pending','completed','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type withdrawal_status as enum ('requested','approved','paid','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_platform as enum ('instagram','tiktok','youtube','twitter','linkedin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_kind as enum ('event','perk','news');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind as enum (
    'application_accepted','application_rejected','deliverable_feedback',
    'deliverable_approved','payment_received','withdrawal_paid','new_message',
    'campaign_match','system'
  );
exception when duplicate_object then null; end $$;

-- Profiles (one row per auth.users row) ------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text not null,
  handle          text not null unique,
  avatar_url      text,
  bio             text,
  role            user_role not null default 'creator',
  verified_pro    boolean not null default false,
  niches          text[] not null default '{}',
  location        text,
  total_reach     integer not null default 0,
  avg_engagement  numeric(5,2) not null default 0,
  total_earned_cents integer not null default 0,
  created_at      timestamptz not null default now(),
  suspended       boolean not null default false
);

-- Social accounts ----------------------------------------------------------
create table if not exists public.social_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  platform        social_platform not null,
  handle          text not null,
  followers       integer not null default 0,
  engagement_rate numeric(5,2) not null default 0,
  connected       boolean not null default false,
  connected_at    timestamptz,
  unique (user_id, platform)
);
create index if not exists social_accounts_user_idx on public.social_accounts(user_id);

-- Brands -------------------------------------------------------------------
create table if not exists public.brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  verified      boolean not null default false,
  website       text,
  industry      text not null,
  description   text,
  contact_email text,
  created_at    timestamptz not null default now()
);

-- Campaigns ----------------------------------------------------------------
create table if not exists public.campaigns (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references public.brands(id) on delete cascade,
  title                text not null,
  cover_image_url      text,
  description          text not null,
  category             text not null,
  tags                 text[] not null default '{}',
  deliverables         jsonb not null default '[]',   -- [{ kind, qty, spec }]
  platforms            social_platform[] not null default '{}',
  base_earning_cents   integer not null default 0,
  commission_pct       numeric(5,2) not null default 0,
  product_bonus        boolean not null default false,
  country_restriction  text,
  slots_total          integer not null default 1,
  slots_filled         integer not null default 0,
  apply_deadline       timestamptz not null,
  draft_deadline       timestamptz not null,
  live_date            timestamptz not null,
  status               campaign_status not null default 'draft',
  featured             boolean not null default false,
  high_ticket          boolean not null default false,
  dos                  text[] not null default '{}',
  donts                text[] not null default '{}',
  created_at           timestamptz not null default now()
);
create index if not exists campaigns_brand_idx on public.campaigns(brand_id);
create index if not exists campaigns_status_idx on public.campaigns(status);

-- Applications -------------------------------------------------------------
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  creator_id   uuid not null references public.profiles(id) on delete cascade,
  pitch        text not null default '',
  status       application_status not null default 'pending',
  applied_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles(id),
  unique (campaign_id, creator_id)
);
create index if not exists applications_creator_idx on public.applications(creator_id);
create index if not exists applications_status_idx on public.applications(status);

-- Deliverables -------------------------------------------------------------
create table if not exists public.deliverables (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  creator_id     uuid not null references public.profiles(id) on delete cascade,
  kind           text not null,
  asset_url      text,
  caption        text,
  status         deliverable_status not null default 'pending',
  feedback       text,
  submitted_at   timestamptz,
  decided_at     timestamptz,
  live_url       text,
  live_at        timestamptz
);
create index if not exists deliverables_creator_idx on public.deliverables(creator_id);
create index if not exists deliverables_status_idx on public.deliverables(status);

-- Message threads ----------------------------------------------------------
create table if not exists public.message_threads (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.profiles(id) on delete cascade,
  brand_id             uuid not null references public.brands(id) on delete cascade,
  campaign_id          uuid references public.campaigns(id) on delete set null,
  last_message_preview text not null default '',
  last_message_at      timestamptz not null default now(),
  unread_count         integer not null default 0,
  brand_online         boolean not null default false,
  status_label         text
);
create index if not exists threads_creator_idx on public.message_threads(creator_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.message_threads(id) on delete cascade,
  sender_id       text not null,             -- creator uuid, 'brand:<id>', or 'system'
  sender_role     text not null check (sender_role in ('creator','brand','system')),
  body            text not null default '',
  attachment_url  text,
  attachment_kind text check (attachment_kind in ('image','video','file')),
  attachment_name text,
  attachment_size text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages(thread_id, created_at);

-- Transactions & withdrawals ----------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          transaction_type not null,
  status        transaction_status not null default 'completed',
  amount_cents  integer not null,
  description   text not null,
  reference_id  text,
  created_at    timestamptz not null default now()
);
create index if not exists transactions_user_idx on public.transactions(user_id, created_at desc);

create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  method        text not null,
  status        withdrawal_status not null default 'requested',
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  paid_at       timestamptz,
  admin_note    text
);
create index if not exists withdrawals_user_idx on public.withdrawals(user_id);
create index if not exists withdrawals_status_idx on public.withdrawals(status);

-- Community (events, perks, news) -----------------------------------------
create table if not exists public.community_items (
  id               uuid primary key default gen_random_uuid(),
  kind             event_kind not null,
  title            text not null,
  description      text not null default '',
  cover_image_url  text,
  brand_id         uuid references public.brands(id) on delete set null,
  city             text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  location_name    text,
  location_address text,
  capacity         integer,
  registered       integer not null default 0,
  price_cents      integer not null default 0,
  perk_code        text,
  url              text,
  published        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists community_kind_idx on public.community_items(kind, published);

-- Notifications ------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        notification_kind not null,
  title       text not null,
  body        text not null default '',
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- Audit logs ---------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  action      text not null,
  entity_kind text not null,
  entity_id   text not null,
  details     text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_admin_idx on public.audit_logs(admin_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Helper: is_admin() — cheap, indexable, used by every policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles          enable row level security;
alter table public.social_accounts   enable row level security;
alter table public.brands            enable row level security;
alter table public.campaigns         enable row level security;
alter table public.applications      enable row level security;
alter table public.deliverables      enable row level security;
alter table public.message_threads   enable row level security;
alter table public.messages          enable row level security;
alter table public.transactions      enable row level security;
alter table public.withdrawals       enable row level security;
alter table public.community_items   enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_logs        enable row level security;

-- profiles: users see their own, all authed users see non-sensitive fields;
-- admins can do anything.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or public.is_admin() or auth.role() = 'authenticated');

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Generic creator-owns-row pattern for tables with user_id / creator_id.
-- social_accounts
drop policy if exists social_owner on public.social_accounts;
create policy social_owner on public.social_accounts
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- brands: readable to all authed users; admins write.
drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands
  for select using (auth.role() = 'authenticated');
drop policy if exists brands_admin_write on public.brands;
create policy brands_admin_write on public.brands
  for all using (public.is_admin()) with check (public.is_admin());

-- campaigns: readable to all authed users; admins write.
drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns
  for select using (auth.role() = 'authenticated');
drop policy if exists campaigns_admin_write on public.campaigns;
create policy campaigns_admin_write on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

-- applications: creator sees/creates own; admin sees all.
drop policy if exists applications_creator on public.applications;
create policy applications_creator on public.applications
  for select using (auth.uid() = creator_id or public.is_admin());
drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications
  for insert with check (auth.uid() = creator_id);
drop policy if exists applications_update_creator on public.applications;
create policy applications_update_creator on public.applications
  for update using (auth.uid() = creator_id and status in ('pending','withdrawn'))
  with check (auth.uid() = creator_id);
drop policy if exists applications_admin on public.applications;
create policy applications_admin on public.applications
  for all using (public.is_admin()) with check (public.is_admin());

-- deliverables: creator manages own drafts; admin moderates.
drop policy if exists deliverables_creator on public.deliverables;
create policy deliverables_creator on public.deliverables
  for select using (auth.uid() = creator_id or public.is_admin());
drop policy if exists deliverables_creator_write on public.deliverables;
create policy deliverables_creator_write on public.deliverables
  for update using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);
drop policy if exists deliverables_admin on public.deliverables;
create policy deliverables_admin on public.deliverables
  for all using (public.is_admin()) with check (public.is_admin());

-- message_threads + messages: participants only.
drop policy if exists threads_participant on public.message_threads;
create policy threads_participant on public.message_threads
  for select using (auth.uid() = creator_id or public.is_admin());
drop policy if exists threads_admin on public.message_threads;
create policy threads_admin on public.message_threads
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists messages_participant on public.messages;
create policy messages_participant on public.messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id and t.creator_id = auth.uid()
    )
  );
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id and t.creator_id = auth.uid()
    )
  );

-- transactions: read-only for owner; write via server/admin only.
drop policy if exists transactions_owner on public.transactions;
create policy transactions_owner on public.transactions
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists transactions_admin on public.transactions;
create policy transactions_admin on public.transactions
  for all using (public.is_admin()) with check (public.is_admin());

-- withdrawals: creator requests own; admin decides.
drop policy if exists withdrawals_owner on public.withdrawals;
create policy withdrawals_owner on public.withdrawals
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists withdrawals_create on public.withdrawals;
create policy withdrawals_create on public.withdrawals
  for insert with check (auth.uid() = user_id);
drop policy if exists withdrawals_admin on public.withdrawals;
create policy withdrawals_admin on public.withdrawals
  for all using (public.is_admin()) with check (public.is_admin());

-- community_items: published rows readable to all authed; admin writes.
drop policy if exists community_read on public.community_items;
create policy community_read on public.community_items
  for select using (published or public.is_admin());
drop policy if exists community_admin on public.community_items;
create policy community_admin on public.community_items
  for all using (public.is_admin()) with check (public.is_admin());

-- notifications: owner reads/updates; admin/server inserts.
drop policy if exists notifications_owner on public.notifications;
create policy notifications_owner on public.notifications
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_logs: admin-only.
drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Auth trigger: insert a profiles row on new auth.users signup.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, handle, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email,'@',1)),
    'creator'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Seed: a couple of brands + community items so the UI isn't empty.
-- Creator/admin profiles are created via Supabase auth signup, not here.
-- ============================================================================
insert into public.brands (id, name, industry, verified, description) values
  (gen_random_uuid(), 'Samsung',      'Tech',     true,  'Electronics & mobile'),
  (gen_random_uuid(), 'Nike Sportswear','Fashion',true,  'Sport & streetwear'),
  (gen_random_uuid(), 'Sephora',      'Beauty',   true,  'Beauty retailer'),
  (gen_random_uuid(), 'CASEtify',     'Tech',     true,  'Device accessories'),
  (gen_random_uuid(), 'L''Oréal Paris','Beauty',  true,  'Global beauty'),
  (gen_random_uuid(), 'GlowCo',       'Beauty',   false, 'Indie skincare'),
  (gen_random_uuid(), 'Zara',         'Fashion',  true,  'Fast fashion')
on conflict do nothing;
