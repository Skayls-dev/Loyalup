create extension if not exists pg_trgm;

create index if not exists idx_fournisseurs_nom_commerce_trgm
  on public.fournisseurs using gin (lower(nom_commerce) gin_trgm_ops);

create index if not exists idx_fournisseurs_adresse_trgm
  on public.fournisseurs using gin (lower(adresse) gin_trgm_ops);

create index if not exists idx_transactions_fournisseur_status_created_at
  on public.transactions (fournisseur_id, status, created_at desc);

create index if not exists idx_reward_rules_fournisseur_actif_delivery
  on public.reward_rules (fournisseur_id, actif, reward_delivery_type);

create or replace function public.directory_search(
  p_search text default null,
  p_min_rating numeric default 0,
  p_delivery text default 'all',
  p_sort_by text default 'performance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  merchant_id uuid,
  merchant_name text,
  address text,
  city text,
  avg_rating numeric,
  rating_count integer,
  active_offers integer,
  transactions_30d integer,
  avg_offer_conversion_rate numeric,
  performance_score integer,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
with offers_agg as (
  select
    rr.fournisseur_id,
    count(*) filter (where rr.actif = true) as active_offers,
    bool_or(rr.actif = true and rr.reward_delivery_type = 'in_store') as has_in_store,
    bool_or(rr.actif = true and rr.reward_delivery_type = 'digital_code') as has_digital
  from public.reward_rules rr
  group by rr.fournisseur_id
),
ratings_agg as (
  select
    mr.fournisseur_id,
    avg(mr.rating)::numeric as avg_rating,
    count(*)::integer as rating_count
  from public.merchant_ratings mr
  group by mr.fournisseur_id
),
transactions_agg as (
  select
    t.fournisseur_id,
    count(*)::integer as transactions_30d
  from public.transactions t
  where t.status = 'validated'
    and t.created_at >= now() - interval '30 days'
  group by t.fournisseur_id
),
reward_usage_agg as (
  select
    rr.fournisseur_id,
    count(*)::integer as claims_30d,
    count(*) filter (where cr.status = 'used')::integer as used_30d
  from public.client_rewards cr
  join public.reward_rules rr on rr.id = cr.reward_rule_id
  where cr.created_at >= now() - interval '30 days'
  group by rr.fournisseur_id
),
base as (
  select
    f.id as merchant_id,
    f.nom_commerce as merchant_name,
    f.adresse as address,
    nullif(trim(substring(coalesce(f.adresse, '') from '[^,]+$')), '') as city,
    coalesce(ra.avg_rating, 0)::numeric as avg_rating,
    coalesce(ra.rating_count, 0)::integer as rating_count,
    coalesce(oa.active_offers, 0)::integer as active_offers,
    coalesce(ta.transactions_30d, 0)::integer as transactions_30d,
    coalesce(ru.used_30d::numeric / nullif(ru.claims_30d, 0), 0)::numeric as avg_offer_conversion_rate,
    coalesce(oa.has_in_store, false) as has_in_store,
    coalesce(oa.has_digital, false) as has_digital
  from public.fournisseurs f
  left join offers_agg oa on oa.fournisseur_id = f.id
  left join ratings_agg ra on ra.fournisseur_id = f.id
  left join transactions_agg ta on ta.fournisseur_id = f.id
  left join reward_usage_agg ru on ru.fournisseur_id = f.id
),
filtered as (
  select *
  from base b
  where (
    nullif(trim(coalesce(p_search, '')), '') is null
    or lower(b.merchant_name) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.address, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(b.city, '')) like '%' || lower(trim(p_search)) || '%'
  )
  and b.avg_rating >= greatest(0, coalesce(p_min_rating, 0))
  and case
    when p_delivery = 'in_store' then b.has_in_store
    when p_delivery = 'digital_code' then b.has_digital
    else true
  end
),
scored as (
  select
    f.*,
    case
      when max(f.transactions_30d) over () > 0
        then f.transactions_30d::numeric / max(f.transactions_30d) over ()
      else 0
    end as tx_norm
  from filtered f
),
ranked as (
  select
    s.merchant_id,
    s.merchant_name,
    s.address,
    s.city,
    s.avg_rating,
    s.rating_count,
    s.active_offers,
    s.transactions_30d,
    s.avg_offer_conversion_rate,
    round((
      0.4 * s.tx_norm
      + 0.35 * least(greatest(s.avg_rating, 0), 5) / 5
      + 0.25 * least(greatest(s.avg_offer_conversion_rate, 0), 1)
    ) * 100)::integer as performance_score,
    count(*) over ()::bigint as total_count
  from scored s
)
select
  r.merchant_id,
  r.merchant_name,
  r.address,
  r.city,
  r.avg_rating,
  r.rating_count,
  r.active_offers,
  r.transactions_30d,
  r.avg_offer_conversion_rate,
  r.performance_score,
  r.total_count
from ranked r
order by
  case when p_sort_by = 'rating' then r.avg_rating end desc nulls last,
  case when p_sort_by = 'transactions' then r.transactions_30d end desc nulls last,
  case when p_sort_by = 'offers' then r.active_offers end desc nulls last,
  case when p_sort_by = 'performance' then r.performance_score end desc nulls last,
  r.performance_score desc,
  r.merchant_name asc
limit greatest(coalesce(p_limit, 20), 1)
offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.directory_search(text, numeric, text, text, integer, integer)
to anon, authenticated;
