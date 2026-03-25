alter table public.list_items
  add column if not exists part_img_url text;

update public.list_items li
set part_img_url = pcc.part_img_url
from public.part_color_catalog pcc
where li.part_img_url is null
  and li.part_num is not null
  and pcc.part_num = li.part_num
  and li.color_name is not null
  and regexp_replace(lower(regexp_replace(li.color_name, '^(lego|bricklink):\s*', '', 'i')), '[^a-z0-9]+', '', 'g')
      = regexp_replace(lower(pcc.color_name), '[^a-z0-9]+', '', 'g')
  and pcc.part_img_url is not null;

update public.list_items li
set part_img_url = pc.part_img_url
from public.parts_catalog pc
where li.part_img_url is null
  and li.part_num is not null
  and pc.part_num = li.part_num
  and pc.part_img_url is not null;
