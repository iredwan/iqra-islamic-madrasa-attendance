-- ============================================================================
--  উপস্থিতি খাতা — FINAL MERGED SCHEMA (v4.0)
--  তিনটা ফাইল একসাথে করা হয়েছে:
--   ১) supabase-schema.sql   (v1 — শুরুর সাদামাটা schema)
--   ২) supabase-schema-v3.sql (v3.1 — multi-tenant madrasa/membership schema)
--   ৩) Plus.sql              (ustaz → ustaza রিনেম মাইগ্রেশন)
--
--  এই ফাইলটা যেকোনো state-এর ডাটাবেসে নিরাপদে চালানো যায়:
--   - সম্পূর্ণ নতুন (empty) ডাটাবেস
--   - v1 schema চালু আছে এমন ডাটাবেস
--   - v3 schema চালু আছে এমন ডাটাবেস (পুরনো 'ustaz' naming সহ বা ছাড়া)
--   - v3 + Plus.sql দুটোই আগে চালানো আছে এমন ডাটাবেস
--
--  একাধিকবার চালালেও নিরাপদ (fully idempotent)। Supabase Dashboard ->
--  SQL Editor -> New query -> পুরোটা পেস্ট করে Run করুন।
--
--  🔧 মার্জ করার সময় যেসব বাগ/সিকিউরিটি-লিক ঠিক করা হয়েছে (নিচে বিস্তারিত):
--   - v1-এর `batches.name` global UNIQUE constraint বাদ, madrasa-scoped
--     করা হয়েছে (নাহলে দুইটা আলাদা মাদ্রাসা একই ব্যাচ-নাম রাখতে পারত না)।
--   - v1-এর "authenticated হলেই সব দেখা/বদলানো যাবে" (using(true)) পলিসি
--     সরিয়ে madrasa-ভিত্তিক isolation (is_member/is_admin) দিয়ে replace
--     করা হয়েছে — এটাই ছিল সবচেয়ে বড় security leak।
--   - v3-এর শেষের legacy-data-backfill ব্লক আগে idempotent ছিল না
--     (রিরান করলে বারবার নতুন madrasa তৈরি হতো) — এখন guard করা হয়েছে।
--   - v1-এর seed batches insert বাদ দেওয়া হয়েছে — multi-tenant মডেলে
--     madrasa_id বাধ্যতামূলক হয়ে যাওয়ায় সেটা সরাসরি error দিত।
-- ============================================================================


-- ============================================================================
-- ভাগ ১: নতুন টেবিল — madrasas, memberships (fresh install হলে সরাসরি
--         final naming ('ustaza') দিয়েই তৈরি হবে)
-- ============================================================================

create table if not exists public.madrasas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text unique not null
              default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  role       text not null default 'ustaza' check (role in ('admin', 'ustaza')),
  full_name  text,
  joined_at  timestamptz not null default now(),
  primary key (user_id, madrasa_id)
);


-- ============================================================================
-- ভাগ ২: পুরনো টেবিল — batches, students, sessions
--         (না থাকলে final naming দিয়েই তৈরি হবে; আগে থেকে v1/v3 আকারে
--          থাকলে নিচের ভাগ ৩ ও ৪ সেগুলোকে patch করে final আকারে আনবে)
-- ============================================================================

create table if not exists public.batches (
  id                uuid primary key default gen_random_uuid(),
  madrasa_id        uuid references public.madrasas(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 40),
  primary_ustaza_id uuid references auth.users(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references public.batches(id) on delete cascade,
  madrasa_id        uuid references public.madrasas(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  roll              text not null check (char_length(btrim(roll)) between 1 and 12),
  phone             text not null check (char_length(btrim(phone)) between 10 and 20),
  whatsapp          text,
  is_active         boolean not null default true,
  primary_ustaza_id uuid references auth.users(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id) on delete cascade,
  madrasa_id   uuid references public.madrasas(id) on delete cascade,
  session_date date not null,
  ustaza_name  text not null default '',
  present_ids  uuid[] not null default '{}',
  absent_ids   uuid[] not null default '{}',
  marks        jsonb not null default '{}'::jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint sessions_batch_date_key unique (batch_id, session_date)
);


-- ============================================================================
-- ভাগ ৩: পুরনো (v1) টেবিলে missing কলাম যোগ — কলাম আগে যোগ হবে,
--         constraint/index পরে (নাহলে ALTER আটকে যাবে)
-- ============================================================================

alter table public.batches
  add column if not exists madrasa_id        uuid references public.madrasas(id) on delete cascade,
  add column if not exists primary_ustaza_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by        uuid references auth.users(id) on delete set null;

alter table public.students
  add column if not exists madrasa_id        uuid references public.madrasas(id) on delete cascade,
  add column if not exists primary_ustaza_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by        uuid references auth.users(id) on delete set null;

alter table public.sessions
  add column if not exists madrasa_id  uuid references public.madrasas(id) on delete cascade,
  add column if not exists marks       jsonb not null default '{}'::jsonb,
  add column if not exists created_by  uuid references auth.users(id) on delete set null;


-- ============================================================================
-- ভাগ ৪: ustaz → ustaza রিনেম মাইগ্রেশন (Plus.sql থেকে, defensive/idempotent)
-- ============================================================================

-- ৪.১) memberships.role: পুরনো constraint সরিয়ে ডেটা আপডেট করে নতুন
--      constraint ও default বসানো হচ্ছে
alter table public.memberships drop constraint if exists memberships_role_check;

update public.memberships set role = 'ustaza' where role = 'ustaz';

alter table public.memberships
  add constraint memberships_role_check check (role in ('admin', 'ustaza'));

alter table public.memberships alter column role set default 'ustaza';

-- ৪.২) sessions.ustaz_name → ustaza_name (v1 ও v3 দুটোতেই পুরনো নাম ছিল)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'ustaz_name'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sessions' and column_name = 'ustaza_name'
    ) then
      -- দুটো কলামই আছে — পুরনো থেকে ডেটা কপি করে পুরনোটা বাদ
      execute 'update public.sessions set ustaza_name = coalesce(ustaza_name, ustaz_name, '''')';
      execute 'alter table public.sessions drop column ustaz_name';
    else
      execute 'alter table public.sessions rename column ustaz_name to ustaza_name';
    end if;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'ustaza_name'
  ) then
    execute 'alter table public.sessions add column ustaza_name text not null default ''''';
  end if;
end $$;

-- ৪.৩) batches.primary_ustaz_id → primary_ustaza_id (defensive — v3 নিজেই
--      এই নাম দিয়ে টেবিল বানায়, কিন্তু পুরনো কোনো ইনস্টলে ভিন্ন নাম থাকলে সামলাবে)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'batches' and column_name = 'primary_ustaz_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'batches' and column_name = 'primary_ustaza_id'
    ) then
      execute 'update public.batches set primary_ustaza_id = coalesce(primary_ustaza_id, primary_ustaz_id)';
      execute 'alter table public.batches drop column primary_ustaz_id';
    else
      execute 'alter table public.batches rename column primary_ustaz_id to primary_ustaza_id';
    end if;
  end if;
end $$;

-- ৪.৪) students.primary_ustaz_id → primary_ustaza_id (একই কারণে defensive)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'primary_ustaz_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'students' and column_name = 'primary_ustaza_id'
    ) then
      execute 'update public.students set primary_ustaza_id = coalesce(primary_ustaza_id, primary_ustaz_id)';
      execute 'alter table public.students drop column primary_ustaz_id';
    else
      execute 'alter table public.students rename column primary_ustaz_id to primary_ustaza_id';
    end if;
  end if;
end $$;


-- ============================================================================
-- ভাগ ৫: 🔒 বাগ-ফিক্স — v1-এর গ্লোবাল ইউনিক ব্যাচ-নাম সরানো
--
--  v1 schema-এ `batches.name` পুরো সিস্টেমে ইউনিক ছিল (multi-tenant ধারণা
--  ছাড়া লেখা)। এখন যেহেতু একাধিক মাদ্রাসা একই ইনস্টলে থাকতে পারে, দুইটা
--  আলাদা মাদ্রাসা একই নামে ব্যাচ ("ব্যাচ ১") বানাতে গেলেই এই constraint
--  error দিত। তাই গ্লোবাল constraint বাদ দিয়ে madrasa-ভিত্তিক করা হলো।
-- ============================================================================

alter table public.batches drop constraint if exists batches_name_key;


-- ============================================================================
-- ভাগ ৬: index (কলাম/নাম ঠিক হওয়ার পর, তাই সবার শেষে নিরাপদ)
-- ============================================================================

-- পুরনো নামের index সরিয়ে নতুন নামে (Plus.sql-এর অংশ)
drop index if exists sessions_ustaz_idx;

create index if not exists memberships_user_idx    on public.memberships (user_id);
create index if not exists memberships_madrasa_idx  on public.memberships (madrasa_id);

create index if not exists batches_madrasa_idx      on public.batches (madrasa_id);

-- একই মাদ্রাসার ভেতরে ব্যাচ-নাম ইউনিক (গ্লোবাল না) — ভাগ ৫-এর সাথে সম্পর্কিত
create unique index if not exists batches_madrasa_name_key
  on public.batches (madrasa_id, name) where madrasa_id is not null;

create index if not exists students_madrasa_idx     on public.students (madrasa_id);
create index if not exists students_batch_idx       on public.students (batch_id);

-- একই ব্যাচে চালু স্টুডেন্টদের রোল ইউনিক হবে
create unique index if not exists students_batch_roll_active_key
  on public.students (batch_id, roll) where is_active;

create index if not exists sessions_madrasa_idx        on public.sessions (madrasa_id);
create index if not exists sessions_madrasa_date_idx   on public.sessions (madrasa_id, session_date desc);
create index if not exists sessions_date_idx           on public.sessions (session_date desc);
create index if not exists sessions_ustaza_idx         on public.sessions (ustaza_name);


-- ============================================================================
-- ভাগ ৭: হেল্পার ফাংশন — is_member / is_admin
--         (security definer + stable, RLS পলিসির ভেতরে recursion এড়াতে)
-- ============================================================================

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
grant execute on function public.is_admin(uuid)  to authenticated;


-- ============================================================================
-- ভাগ ৮: RPC — নিরাপদে মাদ্রাসা তৈরি/জয়েন/ইনভাইট-কোড রোটেট
--         (নতুন membership-এর role এখন থেকে 'ustaza')
-- ============================================================================

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

  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name', '')), ''), email, 'Admin')
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

  if exists (select 1 from public.memberships where user_id = my_id and madrasa_id = mid) then
    return mid;
  end if;

  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name', '')), ''), email, 'উস্তাজা')
    into my_name from auth.users where id = my_id;

  insert into public.memberships (user_id, madrasa_id, role, full_name)
    values (my_id, mid, 'ustaza', my_name);

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
grant execute on function public.rotate_invite_code(uuid)    to authenticated;


-- ============================================================================
-- ভাগ ৯: Trigger — অপরিবর্তনীয় কলাম (created_by, madrasa_id বদলানো যাবে না)
-- ============================================================================

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


-- ============================================================================
-- ভাগ ১০: Trigger — sessions.marks-এর মালিকানা সুরক্ষা
--          (নিজের মার্ক শুধু নিজে/admin বদলাতে বা সরাতে পারবে)
-- ============================================================================

create or replace function public.sessions_marks_guard()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
declare
  key    text;
  old_by uuid;
  new_by uuid;
  my_id  uuid := auth.uid();
  is_adm boolean;
begin
  if my_id is null then
    return new;
  end if;

  is_adm := public.is_admin(new.madrasa_id);

  for key in select jsonb_object_keys(coalesce(old.marks, '{}'::jsonb)) loop
    old_by := nullif(old.marks->key->>'by', '')::uuid;

    if not (new.marks ? key) then
      if old_by is not null and old_by is distinct from my_id and not is_adm then
        raise exception 'অন্য উস্তাজার মার্ক সরানো যাবে না';
      end if;
    else
      new_by := nullif(new.marks->key->>'by', '')::uuid;
      if new_by is distinct from old_by then
        raise exception 'মার্কের মালিকানা বদলানো যাবে না';
      end if;
    end if;
  end loop;

  for key in select jsonb_object_keys(coalesce(new.marks, '{}'::jsonb)) loop
    if not (coalesce(old.marks, '{}'::jsonb) ? key) then
      new_by := nullif(new.marks->key->>'by', '')::uuid;
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


-- ============================================================================
-- ভাগ ১১: Trigger — soft delete শুধু admin করতে পারবে
-- ============================================================================

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


-- ============================================================================
-- ভাগ ১২: 🔒 Row Level Security — madrasa-ভিত্তিক isolation
--
--  v1-এ policy ছিল `using(true)` — মানে লগইন করা যেকোনো ব্যবহারকারী সব
--  মাদ্রাসার সব ডেটা (ছাত্র-ছাত্রীর ফোন নম্বর সহ) দেখতে/বদলাতে পারত। এটাই
--  ছিল সবচেয়ে বড় security leak। এখন প্রতিটি টেবিলের জন্য is_member/is_admin
--  দিয়ে কড়াকড়ি করা হলো, যাতে একজন ব্যবহারকারী শুধু তার নিজের মাদ্রাসার
--  ডেটাই দেখতে/বদলাতে পারে।
-- ============================================================================

alter table public.madrasas    enable row level security;
alter table public.memberships enable row level security;
alter table public.batches     enable row level security;
alter table public.students    enable row level security;
alter table public.sessions    enable row level security;

-- এই ৫টা টেবিলের ওপর থাকা সব পুরনো policy (v1 বা v3/Plus থেকে যেটাই থাকুক)
-- মুছে ফেলা হচ্ছে, যাতে কোনো পুরনো "using(true)" জাতীয় open policy রয়ে না যায়
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('madrasas', 'memberships', 'batches', 'students', 'sessions')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---- Madrasas ----
-- insert শুধু create_madrasa() RPC-এর মাধ্যমে হয় (security definer), তাই
-- এখানে ইচ্ছাকৃতভাবে কোনো insert policy নেই — সরাসরি insert ব্লক থাকবে।
create policy "madrasas read" on public.madrasas
  for select to authenticated
  using (public.is_member(id));

create policy "madrasas update" on public.madrasas
  for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy "madrasas delete" on public.madrasas
  for delete to authenticated
  using (public.is_admin(id));

-- ---- Memberships ----
-- insert শুধু create_madrasa() / join_madrasa_by_code() RPC-এর মাধ্যমে হয়।
create policy "memberships read" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_member(madrasa_id));

create policy "memberships update" on public.memberships
  for update to authenticated
  using (public.is_admin(madrasa_id)) with check (public.is_admin(madrasa_id));

create policy "memberships delete" on public.memberships
  for delete to authenticated
  using (public.is_admin(madrasa_id) or user_id = auth.uid());

-- ---- Batches ----
create policy "batches read" on public.batches
  for select to authenticated
  using (public.is_member(madrasa_id));

create policy "batches insert" on public.batches
  for insert to authenticated
  with check (public.is_admin(madrasa_id) and created_by = auth.uid());

create policy "batches update" on public.batches
  for update to authenticated
  using (public.is_admin(madrasa_id))
  with check (public.is_admin(madrasa_id));

create policy "batches delete" on public.batches
  for delete to authenticated
  using (public.is_admin(madrasa_id));

-- ---- Students ----
create policy "students read" on public.students
  for select to authenticated
  using (public.is_member(madrasa_id));

create policy "students insert" on public.students
  for insert to authenticated
  with check (public.is_member(madrasa_id) and created_by = auth.uid());

create policy "students update" on public.students
  for update to authenticated
  using (public.is_member(madrasa_id) and (created_by = auth.uid() or public.is_admin(madrasa_id)))
  with check (public.is_member(madrasa_id));

create policy "students delete" on public.students
  for delete to authenticated
  using (public.is_admin(madrasa_id));

-- ---- Sessions ----
-- (Plus.sql-এর sessions RLS repair এখানেই একীভূত করা হয়েছে)
create policy "sessions read" on public.sessions
  for select to authenticated
  using (public.is_member(madrasa_id));

create policy "sessions insert" on public.sessions
  for insert to authenticated
  with check (public.is_member(madrasa_id) and created_by = auth.uid());

create policy "sessions update" on public.sessions
  for update to authenticated
  using (public.is_member(madrasa_id))
  with check (public.is_member(madrasa_id));

create policy "sessions delete" on public.sessions
  for delete to authenticated
  using (public.is_member(madrasa_id) and (created_by = auth.uid() or public.is_admin(madrasa_id)));


-- ============================================================================
-- ভাগ ১৩: Grants
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.madrasas, public.memberships,
     public.batches, public.students, public.sessions
  to authenticated;


-- ============================================================================
-- ভাগ ১৪: NOT NULL enforcement (শুধু ডেটা পরিষ্কার থাকলেই বসবে, নাহলে skip)
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.batches  where madrasa_id is null)
     and not exists (select 1 from public.students where madrasa_id is null)
     and not exists (select 1 from public.sessions where madrasa_id is null)
  then
    begin alter table public.batches  alter column madrasa_id set not null; exception when others then null; end;
    begin alter table public.students alter column madrasa_id set not null; exception when others then null; end;
    begin alter table public.sessions alter column madrasa_id set not null; exception when others then null; end;
  end if;
end $$;


-- ============================================================================
-- ভাগ ১৫: 🚨 পুরনো (madrasa_id ছাড়া) ডেটা migration — ঐচ্ছিক, ম্যানুয়াল
--
--  এই ব্লকটা fully guarded ও idempotent:
--   - যদি কোনো orphan row (madrasa_id = null) না থাকে, পুরো ব্লক নিজে থেকেই
--     skip হয়ে যাবে — বারবার চালালেও ডুপ্লিকেট মাদ্রাসা তৈরি হবে না।
--   - admin_id ভুল/না থাকলে পরিষ্কার error দেখাবে, cryptic FK violation না।
--
--  ব্যবহারবিধি:
--   ১) প্রথমে নিজের user id বের করুন:
--      select id, email, created_at from auth.users order by created_at;
--   ২) নিচে 'আপনার-admin-id' বদলে সেটা বসান, তারপর পুরো ব্লক চালান।
-- ============================================================================

do $$
declare
  admin_id   uuid := 'ab86f30a-6003-44b3-966e-4d6ff699afef'; -- এখানে আসল admin uuid বসান
  new_mid    uuid;
  admin_name text;
  has_orphan boolean;
begin
  has_orphan :=
    exists (select 1 from public.batches  where madrasa_id is null)
    or exists (select 1 from public.students where madrasa_id is null)
    or exists (select 1 from public.sessions where madrasa_id is null);

  if not has_orphan then
    raise notice 'কোনো orphan (madrasa_id ছাড়া) ডেটা নেই — legacy migration স্কিপ করা হলো।';
    return;
  end if;

  if not exists (select 1 from auth.users where id = admin_id) then
    raise exception 'admin_id (%) দিয়ে কোনো ব্যবহারকারী পাওয়া যায়নি। '
      'auth.users থেকে সঠিক UUID বসিয়ে আবার চালান।', admin_id;
  end if;

  select coalesce(nullif(btrim(coalesce(raw_user_meta_data->>'full_name', '')), ''), email, 'Admin')
    into admin_name from auth.users where id = admin_id;

  insert into public.madrasas (name, created_by)
    values ('আমার মাদ্রাসা', admin_id)
    returning id into new_mid;

  insert into public.memberships (user_id, madrasa_id, role, full_name)
    values (admin_id, new_mid, 'admin', admin_name);

  insert into public.memberships (user_id, madrasa_id, role, full_name)
  select u.id, new_mid, 'ustaza',
         coalesce(nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''), u.email, 'উস্তাজা')
  from auth.users u where u.id <> admin_id
  on conflict do nothing;

  update public.batches  set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;
  update public.students set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;
  update public.sessions set madrasa_id = new_mid, created_by = coalesce(created_by, admin_id) where madrasa_id is null;

  update public.sessions
  set marks = coalesce(
    (select jsonb_object_agg(pid::text,
      jsonb_build_object('by', admin_id, 'name', coalesce(ustaza_name, 'উস্তাজা')))
     from unnest(present_ids) as pid),
    '{}'::jsonb)
  where marks = '{}'::jsonb and array_length(present_ids, 1) > 0;

  raise notice 'Legacy migration সম্পন্ন — নতুন madrasa_id: %', new_mid;
end $$;


-- ============================================================================
-- ভাগ ১৬: যাচাই (diagnostics) — শুধু তথ্য দেখার জন্য, কোনো ডেটা বদলায় না
-- ============================================================================

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'sessions' and column_name = 'ustaza_name') as sessions_has_ustaza_name,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'sessions' and column_name = 'ustaz_name')  as sessions_has_ustaz_name,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'batches' and column_name = 'primary_ustaza_id') as batches_has_new,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'batches' and column_name = 'primary_ustaz_id')  as batches_has_old,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'students' and column_name = 'primary_ustaza_id') as students_has_new,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'students' and column_name = 'primary_ustaz_id')  as students_has_old,
  (select count(*) from public.memberships where role = 'ustaza') as ustaza_rows,
  (select count(*) from public.memberships where role = 'ustaz')  as ustaz_rows,
  (select count(*) from public.batches  where madrasa_id is null) as batches_orphan,
  (select count(*) from public.students where madrasa_id is null) as students_orphan,
  (select count(*) from public.sessions where madrasa_id is null) as sessions_orphan;

select
  auth.uid() as logged_in_user,
  coalesce((select id from public.madrasas order by created_at limit 1), null) as sample_madrasa,
  exists (select 1 from public.memberships where user_id = auth.uid()) as has_membership;