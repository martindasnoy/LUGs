insert into public.app_maintenance (id, enabled, message_line1, message_line2)
values (1, false, 'Estamos en mantenimiento', 'Volve en un rato')
on conflict (id) do nothing;

drop policy if exists app_maintenance_insert_master on public.app_maintenance;
create policy app_maintenance_insert_master on public.app_maintenance
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_master = true
  )
);
