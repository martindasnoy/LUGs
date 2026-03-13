alter table public.list_items
  add column if not exists imgmatchcolor boolean not null default true;

update public.list_items li
set imgmatchcolor = case
  when li.color_name is null then true
  when exists (
    select 1
    from public.part_color_catalog pcc
    where pcc.part_num = li.part_num
      and lower(trim(regexp_replace(pcc.color_name, '[^a-z0-9]+', ' ', 'g'))) =
          lower(trim(regexp_replace(regexp_replace(li.color_name, '^(LEGO|BrickLink):\s*', '', 'i'), '[^a-z0-9]+', ' ', 'g')))
  ) then true
  else false
end;
