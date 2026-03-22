set search_path = public;

create or replace function public.notify_reward_unlocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_name text;
  v_points integer;
  v_title text;
  v_subtitle text;
begin
  select rr.nom, rr.points_required
  into v_rule_name, v_points
  from public.reward_rules rr
  where rr.id = new.reward_rule_id;

  v_title := coalesce(v_rule_name, 'Nouvelle recompense debloquee');
  v_subtitle := case
    when v_points is not null and v_points > 0 then format('Offre debloquee a %s points.', v_points)
    else 'Offre debloquee avec vos points.'
  end;

  perform public.notify_user(
    new.client_id,
    'points',
    v_title,
    v_subtitle,
    jsonb_build_object(
      'event', 'reward_unlocked',
      'client_reward_id', new.id,
      'reward_rule_id', new.reward_rule_id,
      'fournisseur_id', new.fournisseur_id,
      'status', new.status
    ),
    null
  );

  return new;
end;
$$;

revoke all on function public.notify_reward_unlocked() from public;

drop trigger if exists trg_notify_reward_unlocked on public.client_rewards;

create trigger trg_notify_reward_unlocked
after insert on public.client_rewards
for each row
execute function public.notify_reward_unlocked();
