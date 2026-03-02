create table if not exists public.scan_screen_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scan_screen_ads_active_order
  on public.scan_screen_ads (active, display_order, created_at desc);

alter table public.scan_screen_ads enable row level security;

drop policy if exists "Authenticated users read active scan ads" on public.scan_screen_ads;
create policy "Authenticated users read active scan ads"
  on public.scan_screen_ads
  for select
  to authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop trigger if exists trg_scan_screen_ads_updated_at on public.scan_screen_ads;
create trigger trg_scan_screen_ads_updated_at
before update on public.scan_screen_ads
for each row
execute function public.set_updated_at();