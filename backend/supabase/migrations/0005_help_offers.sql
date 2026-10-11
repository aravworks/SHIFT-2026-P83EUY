-- Riders offering to help a stranded peer ("I can help this rider")
create table if not exists help_offers (
  id uuid primary key default gen_random_uuid(),
  alert_msg_id bigint not null references alerts(msg_id) on delete cascade,
  helper_node int not null,
  eta_minutes int check (eta_minutes is null or eta_minutes >= 0),
  status text not null default 'offered' check (status in ('offered', 'withdrawn')),
  created_at timestamptz default now(),
  unique (alert_msg_id, helper_node)
);

alter table help_offers enable row level security;
revoke all on help_offers from anon, authenticated;
grant select on help_offers to authenticated;
drop policy if exists "staff read help offers" on help_offers;
create policy "staff read help offers" on help_offers for select to authenticated
  using (app_role() in ('admin', 'fleet', 'station'));

alter publication supabase_realtime add table help_offers;
