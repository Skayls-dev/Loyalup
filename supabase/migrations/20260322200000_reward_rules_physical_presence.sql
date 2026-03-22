-- Add physical presence requirement flag to reward_rules.
-- When true, the client may only use the reward during an active transaction
-- (the Edge Function unlock-reward must receive a valid pending_transaction_id
-- belonging to the same provider, ensuring the client is physically present
-- at the point of sale).

alter table if exists public.reward_rules
  add column if not exists requires_physical_presence boolean not null default false;

comment on column public.reward_rules.requires_physical_presence is
  'When true, the reward can only be consumed during an active pending transaction '
  '(the client must be physically present at the provider point of sale). '
  'The unlock-reward Edge Function must receive a pending_transaction_id to validate '
  'physical presence before allowing the reward to be used.';
