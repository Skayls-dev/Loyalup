alter table public.transactions
  add column if not exists sumup_transaction_ids text[] null,
  add column if not exists sumup_transaction_codes text[] null;

create index if not exists idx_transactions_sumup_transaction_ids
  on public.transactions using gin (sumup_transaction_ids);

create index if not exists idx_transactions_sumup_transaction_codes
  on public.transactions using gin (sumup_transaction_codes);
