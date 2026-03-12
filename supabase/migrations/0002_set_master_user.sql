-- Set one master user by email
-- Replace the email before running this file.

update public.profiles
set is_master = false
where is_master = true;

update public.profiles p
set is_master = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('TU_EMAIL_MASTER@MAIL.COM');
