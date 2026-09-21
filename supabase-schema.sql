-- =====================================================================
--  উপস্থিতি খাতা : Supabase schema
--  ব্যবহার: Supabase Dashboard -> SQL Editor -> New query -> পুরোটা পেস্ট করে Run
--  স্ক্রিপ্টটি একাধিকবার চালালেও সমস্যা নেই (idempotent)।
-- =====================================================================

-- ---------- ১) ব্যাচ (ক্লাস) ----------
create table if not exists public.batches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) > 0),
  created_at  timestamptz not null default now(),
  constraint batches_name_key unique (name)
);

-- ---------- ২) স্টুডেন্ট ----------
-- is_active = false মানে তালিকা থেকে সরানো হয়েছে, কিন্তু পুরনো রিপোর্ট অক্ষত থাকবে।
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) > 0),
  roll        text not null check (char_length(btrim(roll)) > 0),
  phone       text not null check (char_length(btrim(phone)) > 0),
  whatsapp    text,                       -- ঐচ্ছিক
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- একই ব্যাচে চালু স্টুডেন্টদের রোল ইউনিক হবে
create unique index if not exists students_batch_roll_active_key
  on public.students (batch_id, roll) where is_active;

create index if not exists students_batch_idx
  on public.students (batch_id);

-- ---------- ৩) হাজিরা রিপোর্ট (একটি ব্যাচের একটি তারিখে একটিই রিপোর্ট) ----------
-- present_ids / absent_ids : ওই দিন যেসব স্টুডেন্ট উপস্থিত / অনুপস্থিত ছিল তাদের id।
-- এক সারিতেই পুরো রিপোর্ট থাকে, তাই সংরক্ষণ সবসময় একটি অ্যাটমিক অপারেশন।
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.batches (id) on delete cascade,
  session_date  date not null,
  ustaz_name    text not null check (char_length(btrim(ustaz_name)) > 0),
  present_ids   uuid[] not null default '{}',
  absent_ids    uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sessions_batch_date_key unique (batch_id, session_date)
);

create index if not exists sessions_date_idx  on public.sessions (session_date desc);
create index if not exists sessions_ustaz_idx on public.sessions (ustaz_name);

-- ---------- ৪) নিরাপত্তা (Row Level Security) ----------
-- শুধু লগইন করা ব্যবহারকারীরাই ডেটা দেখতে/বদলাতে পারবে।
-- (স্টুডেন্টদের ফোন নম্বর আছে, তাই লগইন ছাড়া ডেটা খোলা রাখা হয়নি।)
alter table public.batches  enable row level security;
alter table public.students enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "batches: authenticated full access"  on public.batches;
drop policy if exists "students: authenticated full access" on public.students;
drop policy if exists "sessions: authenticated full access" on public.sessions;

create policy "batches: authenticated full access"
  on public.batches  for all to authenticated using (true) with check (true);

create policy "students: authenticated full access"
  on public.students for all to authenticated using (true) with check (true);

create policy "sessions: authenticated full access"
  on public.sessions for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.batches, public.students, public.sessions
  to authenticated;

-- ---------- ৫) শুরুর ব্যাচ (চাইলে পরে অ্যাপ থেকে বদলাতে/মুছতে পারবেন) ----------
insert into public.batches (name, created_at) values
  ('ব্যাচ ১', now()),
  ('ব্যাচ ২', now() + interval '1 second'),
  ('ব্যাচ ৩', now() + interval '2 seconds')
on conflict (name) do nothing;
