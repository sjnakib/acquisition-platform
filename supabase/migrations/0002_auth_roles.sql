create type public.user_role as enum ('internal', 'client');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          public.user_role not null default 'internal',
  client_org    text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role
  );

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
