-- Add service linking columns to transactions table for product/catalog mapping with SumUp amounts
alter table public.transactions
  add column if not exists service_ids uuid[] null,
  add column if not exists product_label text null;

-- Index for service_ids array queries
create index if not exists idx_transactions_service_ids
  on public.transactions using gin (service_ids);

-- Add comment for clarity
comment on column public.transactions.service_ids is 'Array of service IDs linked to this transaction for catalog mapping';
comment on column public.transactions.product_label is 'Free-text product/service name when not using catalog services';
