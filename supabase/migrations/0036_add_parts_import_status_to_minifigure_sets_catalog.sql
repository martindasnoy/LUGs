alter table public.minifigure_sets_catalog
add column if not exists parts_import_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'minifigure_sets_catalog_parts_import_status_check'
  ) then
    alter table public.minifigure_sets_catalog
    add constraint minifigure_sets_catalog_parts_import_status_check
    check (parts_import_status in ('pending', 'imported', 'empty', 'error'));
  end if;
end $$;

update public.minifigure_sets_catalog s
set parts_import_status = 'imported'
where exists (
  select 1
  from public.minifigure_set_parts_catalog p
  where p.set_num = s.set_num
);
