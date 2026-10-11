-- Atomic stock change used by POST /admin/stations/:id/stock (+/- buttons in the portal).
-- Locks the station row, refuses to drop stock below active holds, and bumps stock_version so the
-- newer count replaces older ones. Mesh packets carry stock as one byte, hence the 0-255 range.
create or replace function adjust_station_stock(p_station uuid, p_delta int, p_set int)
returns int language plpgsql as $$
declare v_cur int; v_new int; v_held int;
begin
  select coalesce(batteries_available, 0) into v_cur from stations where id = p_station for update;
  if not found then raise exception 'unknown station' using errcode = 'P0002'; end if;
  v_new := coalesce(p_set, v_cur + coalesce(p_delta, 0));
  if v_new < 0 or v_new > 255 then raise exception 'stock must be between 0 and 255' using errcode = '22003'; end if;
  perform expire_reservations();
  select count(*) into v_held from reservations where station_id = p_station and status = 'held';
  if v_new < v_held then raise exception 'stock would fall below the % active holds', v_held using errcode = '23514'; end if;
  update stations
     set batteries_available = v_new, stock_version = coalesce(stock_version, 0) + 1, stock_updated_at = now()
   where id = p_station;
  return v_new;
end $$;
revoke execute on function adjust_station_stock(uuid, int, int) from public, anon, authenticated;
