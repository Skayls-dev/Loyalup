revoke all on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) from anon;
revoke all on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) from authenticated;
grant execute on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) to service_role;
