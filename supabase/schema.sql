-- Homework
create table homework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  due_date date,
  notes text,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Todos
create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  due_date date,
  priority text check (priority in ('low','medium','high')),
  completed boolean default false,
  created_at timestamptz default now()
);

-- Past Papers
create table past_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject text not null,
  year int,
  score numeric,
  max_score numeric,
  notes text,
  completed_at date,
  created_at timestamptz default now()
);

-- Study Sessions
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject text,
  duration_minutes int,
  notes text,
  created_at timestamptz default now()
);

-- Calendar Events
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  color text,
  created_at timestamptz default now()
);

-- Notes
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  content text default '',
  subject text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table homework enable row level security;
alter table todos enable row level security;
alter table past_papers enable row level security;
alter table study_sessions enable row level security;
alter table calendar_events enable row level security;
alter table notes enable row level security;

create policy "own data" on homework for all using (auth.uid() = user_id);
create policy "own data" on todos for all using (auth.uid() = user_id);
create policy "own data" on past_papers for all using (auth.uid() = user_id);
create policy "own data" on study_sessions for all using (auth.uid() = user_id);
create policy "own data" on calendar_events for all using (auth.uid() = user_id);
create policy "own data" on notes for all using (auth.uid() = user_id);
