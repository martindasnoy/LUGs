create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  fallback_username text;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]+', '', 'g'));
  if base_username is null or base_username = '' then
    base_username := 'usuario';
  end if;

  fallback_username := base_username || '_' || left(replace(new.id::text, '-', ''), 8);

  begin
    insert into public.profiles (id, username)
    values (new.id, base_username)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.profiles (id, username)
      values (new.id, fallback_username)
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
