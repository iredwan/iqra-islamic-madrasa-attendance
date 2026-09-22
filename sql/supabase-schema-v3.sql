-- ============================================================
-- উপস্থিতি খাতা v3.1 — Production Schema (order fixed)
-- পুরনো ডেটাসহ নিরাপদে চলবে, একাধিকবার চালানো যাবে
-- ============================================================

-- ========== ভাগ ১: নতুন টেবিল (madrasas, memberships) ==========
create table if not exists public.madrasas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text unique not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  role       text not null default 'ustaz' check (role in ('admin','ustaz')),
  full_name  text,
  joined_at  timestamptz not null default now(),
  primary key (user_id, madrasa_id)
);

-- ========== ভাগ ২: পুরনো টেবিল তৈরি (যদি না থাকে) ==========
create table if not exists public.batches (
  id               uuid primary key default gen_random_uuid(),
  madrasa_id       uuid references public.madrasas(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 40),
  primary_ustaza_id uuid references auth.users(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.batches(id) on delete cascade,
  madrasa_id       uuid references public.madrasas(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  roll             text not null check (char_length(btrim(roll)) between 1 and 12),
  phone            text not null check (char_length(btrim(phone)) between 10 and 20),
  whatsapp         text,
  is_active        boolean not null default true,
  primary_ustaza_id uuid references auth.users(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id) on delete cascade,
  madrasa_id   uuid references public.madrasas(id) on delete cascade,
  session_date date not null,
  ustaz_name   text not null default '',
  present_ids  uuid[] not null default '{}',
  absent_ids   uuid[] not null default '{}',
  marks        jsonb  not null default '{}'::jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint sessions_batch_date_key unique (batch_id, session_date)
);

-- ========== ভাগ ৩: পুরনো টেবিলে কলাম যোগ (migration) ==========
-- এখানেই মূল fix: কলাম আগে যোগ হবে, index পরে তৈরি হবে।

alter table public.batches
  add column if not exists madrasa_id       uuid references public.madrasas(id) on delete cascade,
  add column if not exists primary_ustaza_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by       uuid references auth.users(id) on delete set null;

alter table public.students
  add column if not exists madrasa_id       uuid references public.madrasas(id) on delete cascade,
  add column if not exists primary_ustaza_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by       uuid references auth.users(id) on delete set null;

alter table public.sessions
  add column if not exists madrasa_id uuid references public.madrasas(id) on delete cascade,
  add column if not exists marks      jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ========== ভাগ ৪: index (কলাম যোগ হওয়ার পর নিরাপদ) ==========
create index if not exists memberships_user_idx    on public.memberships (user_id);
create index if not exists memberships_madrasa_idx on public.memberships (madrasa_id);

create index if not exists batches_madrasa_idx  on public.batches  (madrasa_id);
create index if not exists students_madrasa_idx on public.students (madrasa_id);
create index if not exists students_batch_idx   on public.students (batch_id);
create index if not exists sessions_madrasa_idx on public.sessions (madrasa_id);
create index if not exists sessions_madrasa_date_idx on public.sessions (madrasa_id, session_date desc);

create unique index if not exists students_batch_roll_active_key
  on public.students (batch_id, roll) where is_active;

-- ========== ভাগ ৫: হেল্পার ফাংশন ==========
create or replace function public.is_member(m_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_catalog
as $$
  select m_id is not null and exists(
    select 1 from public.memberships
    where user_id = auth.uid() and madrasa_id = m_id
  );
$$;

create or replace function public.is_admin(m_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_catalog
as $$
  select m_id is not null and exists(
    select 1 from public.memberships
    where user_id = auth.uid() and madrasa_id = m_id and role = 'admin'
  );
$$;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- ========== ভাগ ৬: RPC — নিরাপদে মাদ্রাসা তৈরি/জয়েন ==========
create or replace function public.create_madrasa(p_name text)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  new_id  uuid;
  my_id   uuid := auth.uid();
  my_name text;
begin
  if my_id is null then
    raise exception 'লগইন করা আবশ্যক';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) = 0 then
    raise exception 'মাদ্রাসার নাম দিন';
  end if;
  if length(p_name) > 60 then
    raise exception 'নাম ৬০ অক্ষরের বেশি হতে পারবে না';
  end if;

  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name','')),''), email, 'Admin')
    into my_name from auth.users where id = my_id;

  insert into public.madrasas (name, created_by)
    values (p_name, my_id)
    returning id into new_id;

  insert into public.memberships (user_id, madrasa_id, role, full_name)
    values (my_id, new_id, 'admin', my_name);

  return new_id;
end;
$$;

create or replace function public.join_madrasa_by_code(p_code text)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  mid     uuid;
  my_id   uuid := auth.uid();
  my_name text;
begin
  if my_id is null then
    raise exception 'লগইন করা আবশ্যক';
  end if;

  p_code := upper(btrim(coalesce(p_code, '')));
  if length(p_code) = 0 then
    raise exception 'ইনভাইট কোড দিন';
  end if;

  select id into mid from public.madrasas where invite_code = p_code limit 1;
  if mid is null then
    raise exception 'এই কোডে কোনো মাদ্রাসা পাওয়া যায়নি';
  end if;

  if exists(select 1 from public.memberships where user_id = my_id and madrasa_id = mid) then
    return mid;
  end if;

  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name','')),''), email, 'উস্তাজ')
    into my_name from auth.users where id = my_id;

  insert into public.memberships (user_id, madrasa_id, role, full_name)
    values (my_id, mid, 'ustaz', my_name);

  return mid;
end;
$$;

create or replace function public.rotate_invite_code(p_madrasa_id uuid)
returns text language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare new_code text;
begin
  if not public.is_admin(p_madrasa_id) then
    raise exception 'শুধু admin কোড বদলাতে পারে';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  update public.madrasas set invite_code = new_code where id = p_madrasa_id;
  return new_code;
end;
$$;

grant execute on function public.create_madrasa(text)       to authenticated;
grant execute on function public.join_madrasa_by_code(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid)   to authenticated;

-- ========== ভাগ ৭: Trigger — অপরিবর্তনীয় কলাম ==========
create or replace function public.protect_immutable_cols()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if old.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'created_by পরিবর্তন করা যাবে না';
  end if;
  if old.madrasa_id is not null and new.madrasa_id is distinct from old.madrasa_id then
    raise exception 'madrasa_id পরিবর্তন করা যাবে না';
  end if;
  return new;
end;
$$;

drop trigger if exists batches_immutable_trg  on public.batches;
drop trigger if exists students_immutable_trg on public.students;
drop trigger if exists sessions_immutable_trg on public.sessions;

create trigger batches_immutable_trg  before update on public.batches
  for each row execute function public.protect_immutable_cols();
create trigger students_immutable_trg before update on public.students
  for each row execute function public.protect_immutable_cols();
create trigger sessions_immutable_trg before update on public.sessions
  for each row execute function public.protect_immutable_cols();

-- ========== ভাগ ৮: Trigger — মার্ক সুরক্ষা ==========
create or replace function public.sessions_marks_guard()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
declare
  key      text;
  old_by   uuid;
  new_by   uuid;
  my_id    uuid := auth.uid();
  is_adm   boolean;
begin
  if my_id is null then
    return new;
  end if;

  is_adm := public.is_admin(new.madrasa_id);

  for key in select jsonb_object_keys(coalesce(old.marks, '{}'::jsonb)) loop
    old_by := nullif(old.marks->key->>'by','')::uuid;

    if not (new.marks ? key) then
      if old_by is not null and old_by is distinct from my_id and not is_adm then
        raise exception 'অন্য উস্তাজের মার্ক সরানো যাবে না';
      end if;
    else
      new_by := nullif(new.marks->key->>'by','')::uuid;
      if new_by is distinct from old_by then
        raise exception 'মার্কের মালিকানা বদলানো যাবে না';
      end if;
    end if;
  end loop;

  for key in select jsonb_object_keys(coalesce(new.marks, '{}'::jsonb)) loop
    if not (coalesce(old.marks, '{}'::jsonb) ? key) then
      new_by := nullif(new.marks->key->>'by','')::uuid;
      if new_by is distinct from my_id and not is_adm then
        raise exception 'নিজের নাম ছাড়া অন্য কারও মার্ক যোগ করা যাবে না';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists sessions_marks_guard_trg on public.sessions;
create trigger sessions_marks_guard_trg
  before update on public.sessions
  for each row execute function public.sessions_marks_guard();

-- ========== ভাগ ৯: Trigger — soft delete শুধু admin ==========
create or replace function public.students_softdelete_guard()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if old.is_active = true and new.is_active = false then
    if not public.is_admin(new.madrasa_id) then
      raise exception 'স্টুডেন্ট সরানোর অধিকার শুধু admin-এর';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists students_softdelete_trg on public.students;
create trigger students_softdelete_trg
  before update on public.students
  for each row execute function public.students_softdelete_guard();

-- ========== ভাগ ১০: RLS ==========
alter table public.madrasas    enable row level security;
alter table public.memberships enable row level security;
alter table public.batches     enable row level security;
alter table public.students    enable row level security;
alter table public.sessions    enable row level security;

-- পুরনো সব policy মুছুন
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('madrasas','memberships','batches','students','sessions')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Madrasas
create policy "madrasas read"   on public.madrasas for select to authenticated
  using (public.is_member(id));
create policy "madrasas update" on public.madrasas for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));
create policy "madrasas delete" on public.madrasas for delete to authenticated
  using (public.is_admin(id));

-- Memberships
create policy "memberships read"   on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_member(madrasa_id));
create policy "memberships update" on public.memberships for update to authenticated
  using (public.is_admin(madrasa_id)) with check (public.is_admin(madrasa_id));
create policy "memberships delete" on public.memberships for delete to authenticated
  using (public.is_admin(madrasa_id) or user_id = auth.uid());

-- Batches
create policy "batches read"   on public.batches for select to authenticated
  using (public.is_member(madrasa_id));
create policy "batches insert" on public.batches for insert to authenticated
  with check (public.is_admin(madrasa_id) and created_by = auth.uid());
create policy "batches update" on public.batches for update to authenticated
  using (public.is_admin(madrasa_id))
  with check (public.is_admin(madrasa_id));
create policy "batches delete" on public.batches for delete to authenticated
  using (public.is_admin(madrasa_id));

-- Students
create policy "students read"   on public.students for select to authenticated
  using (public.is_member(madrasa_id));
create policy "students insert" on public.students for insert to authenticated
  with check (public.is_member(madrasa_id) and created_by = auth.uid());
create policy "students update" on public.students for update to authenticated
  using (public.is_member(madrasa_id) and (created_by = auth.uid() or public.is_admin(madrasa_id)))
  with check (public.is_member(madrasa_id));
create policy "students delete" on public.students for delete to authenticated
  using (public.is_admin(madrasa_id));

-- Sessions
create policy "sessions read"   on public.sessions for select to authenticated
  using (public.is_member(madrasa_id));
create policy "sessions insert" on public.sessions for insert to authenticated
  with check (public.is_member(madrasa_id) and created_by = auth.uid());
create policy "sessions update" on public.sessions for update to authenticated
  using (public.is_member(madrasa_id))
  with check (public.is_member(madrasa_id));
create policy "sessions delete" on public.sessions for delete to authenticated
  using (public.is_member(madrasa_id) and (created_by = auth.uid() or public.is_admin(madrasa_id)));

-- ========== ভাগ ১১: Grants ==========
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.madrasas, public.memberships,
     public.batches, public.students, public.sessions
  to authenticated;

-- ========== ভাগ ১২: NOT NULL (শুধু ডেটা পরিষ্কার থাকলে) ==========
do $$
begin
  if not exists(select 1 from public.batches  where madrasa_id is null)
     and not exists(select 1 from public.students where madrasa_id is null)
     and not exists(select 1 from public.sessions where madrasa_id is null)
  then
    begin alter table public.batches  alter column madrasa_id set not null; exception when others then null; end;
    begin alter table public.students alter column madrasa_id set not null; exception when others then null; end;
    begin alter table public.sessions alter column madrasa_id set not null; exception when others then null; end;
  end if;
end $$;

-- ============================================================
-- 🚨 পুরনো ডেটা migration (ঐচ্ছিক)
-- ============================================================
-- ১) প্রথমে নিজের user id বের করুন:
--    select id, email, created_at from auth.users order by created_at;
--
-- ২) নিচের কোডে 'আপনার-admin-id' বদলে সেটা বসিয়ে সব -- চিহ্ন সরিয়ে চালান
--
do $$
declare
  admin_id uuid := 'ab86f30a-6003-44b3-966e-4d6ff699afef';
  new_mid  uuid;
  admin_name text;
begin
  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name','')),''), email, 'Admin')
    into admin_name from auth.users where id = admin_id;

  insert into public.madrasas (name, created_by)
    values ('আমার মাদ্রাসা', admin_id)
    returning id into new_mid;

  insert into public.memberships (user_id, madrasa_id, role, full_name)
    values (admin_id, new_mid, 'admin', admin_name);

  insert into public.memberships (user_id, madrasa_id, role, full_name)
  select u.id, new_mid, 'ustaz',
         coalesce(nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name','')),''), u.email, 'উস্তাজ')
  from auth.users u where u.id <> admin_id
  on conflict do nothing;

  update public.batches  set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;
  update public.students set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;
  update public.sessions set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;

  update public.sessions
  set marks = coalesce(
    (select jsonb_object_agg(pid::text,
      jsonb_build_object('by', admin_id, 'name', coalesce(ustaz_name, 'উস্তাজ')))
     from unnest(present_ids) as pid),
    '{}'::jsonb)
  where marks = '{}'::jsonb and array_length(present_ids, 1) > 0;
end $$;