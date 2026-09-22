-- ============================================================
-- MIGRATION: ustaz → ustaza
-- পুরনো ডেটাবেস থেকে নতুন naming-এ রূপান্তর
-- একবার চালান। idempotent — আবার চালালেও নিরাপদ।
-- ============================================================

-- ▓▓▓ ১) memberships.role constraint ও ডেটা আপডেট ▓▓▓

-- পুরনো constraint আগে সরাই (নাহলে UPDATE আটকে যাবে)
alter table public.memberships drop constraint if exists memberships_role_check;

-- পুরনো মানগুলো নতুনে বদলাই
update public.memberships set role = 'ustaza' where role = 'ustaz';

-- নতুন constraint বসাই
alter table public.memberships
  add constraint memberships_role_check check (role in ('admin','ustaza'));


-- ▓▓▓ ২) sessions.ustaz_name → ustaza_name ▓▓▓
do $$
begin
  if exists(select 1 from information_schema.columns
            where table_schema='public' and table_name='sessions'
              and column_name='ustaz_name')
  then
    if exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='sessions'
                and column_name='ustaza_name')
    then
      -- দুটো কলামই আছে — পুরনো থেকে ডেটা কপি করে পুরনোটা বাদ
      execute 'update public.sessions set ustaza_name = coalesce(ustaza_name, ustaz_name, '''')';
      execute 'alter table public.sessions drop column ustaz_name';
    else
      -- শুধু পুরনো আছে — rename করি
      execute 'alter table public.sessions rename column ustaz_name to ustaza_name';
    end if;
  end if;
end $$;

-- কলাম কোনোটাই না থাকলে নতুন করে যোগ করি
do $$
begin
  if not exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='sessions'
                  and column_name='ustaza_name')
  then
    execute 'alter table public.sessions add column ustaza_name text not null default ''''';
  end if;
end $$;


-- ▓▓▓ ৩) batches.primary_ustaz_id → primary_ustaza_id ▓▓▓
do $$
begin
  if exists(select 1 from information_schema.columns
            where table_schema='public' and table_name='batches'
              and column_name='primary_ustaz_id')
  then
    if exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='batches'
                and column_name='primary_ustaza_id')
    then
      execute 'update public.batches set primary_ustaza_id = coalesce(primary_ustaza_id, primary_ustaz_id)';
      execute 'alter table public.batches drop column primary_ustaz_id';
    else
      execute 'alter table public.batches rename column primary_ustaz_id to primary_ustaza_id';
    end if;
  end if;
end $$;

do $$
begin
  if not exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='batches'
                  and column_name='primary_ustaza_id')
  then
    execute 'alter table public.batches add column primary_ustaza_id uuid references auth.users(id) on delete set null';
  end if;
end $$;


-- ▓▓▓ ৪) students.primary_ustaz_id → primary_ustaza_id ▓▓▓
do $$
begin
  if exists(select 1 from information_schema.columns
            where table_schema='public' and table_name='students'
              and column_name='primary_ustaz_id')
  then
    if exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='students'
                and column_name='primary_ustaza_id')
    then
      execute 'update public.students set primary_ustaza_id = coalesce(primary_ustaza_id, primary_ustaz_id)';
      execute 'alter table public.students drop column primary_ustaz_id';
    else
      execute 'alter table public.students rename column primary_ustaz_id to primary_ustaza_id';
    end if;
  end if;
end $$;

do $$
begin
  if not exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='students'
                  and column_name='primary_ustaza_id')
  then
    execute 'alter table public.students add column primary_ustaza_id uuid references auth.users(id) on delete set null';
  end if;
end $$;


-- ▓▓▓ ৫) sessions-এর পুরনো index rename ▓▓▓
drop index if exists sessions_ustaz_idx;
create index if not exists sessions_ustaza_idx on public.sessions (ustaza_name);


-- ▓▓▓ ৬) যাচাই — এই query-র ফলাফল দেখুন ▓▓▓
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='sessions' and column_name='ustaza_name')   as sessions_has_ustaza_name,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='sessions' and column_name='ustaz_name')    as sessions_has_ustaz_name,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='batches'  and column_name='primary_ustaza_id') as batches_has_new,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='batches'  and column_name='primary_ustaz_id')  as batches_has_old,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='students' and column_name='primary_ustaza_id') as students_has_new,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='students' and column_name='primary_ustaz_id')  as students_has_old,
  (select count(*) from public.memberships where role='ustaza') as ustaza_rows,
  (select count(*) from public.memberships where role='ustaz')  as ustaz_rows;