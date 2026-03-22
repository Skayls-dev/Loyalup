alter table if exists public.reward_rules
  add column if not exists expiry_date date null;

create index if not exists idx_reward_rules_expiry_date
  on public.reward_rules (expiry_date);