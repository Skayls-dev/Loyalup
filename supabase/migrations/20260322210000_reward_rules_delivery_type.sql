-- Add reward delivery type on reward_rules.
-- V1 only supports in-store redemption. A digital code flow is reserved for
-- future e-commerce usage.

alter table if exists public.reward_rules
  add column if not exists reward_delivery_type text not null default 'in_store';

-- Be explicit for existing rows, even though the default already covers them.
update public.reward_rules
set reward_delivery_type = 'in_store'
where reward_delivery_type is distinct from 'in_store';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reward_rules_reward_delivery_type_check'
      and conrelid = 'public.reward_rules'::regclass
  ) then
    alter table public.reward_rules
      add constraint reward_rules_reward_delivery_type_check
      check (reward_delivery_type in ('in_store', 'digital_code'));
  end if;
end $$;

comment on column public.reward_rules.reward_delivery_type is
  'V1: only in_store is implemented. digital_code is reserved for a future e-commerce flow '
  'where the client receives a unique promo code to use on the merchant online shop.';
