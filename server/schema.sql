create table if not exists students (
  id bigserial primary key,
  full_name text not null,
  subteam text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  role text not null default 'student' check (role in ('student','mentor')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id bigserial primary key,
  title text not null,
  subteam text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  description text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add archived column if this DB was created before archiving existed
alter table tasks add column if not exists archived boolean not null default false;

create table if not exists task_assignments (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  unique (task_id, student_id, unassigned_at)
);

create table if not exists task_comments (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  author_type text not null default 'mentor' check (author_type in ('student','mentor')),
  author_label text not null default '',
  comment text not null,
  created_at timestamptz not null default now()
);

-- Ensure a student can only be actively assigned once per task (prevents duplicate join/assign)
create unique index if not exists task_assignments_active_unique
  on task_assignments (task_id, student_id)
  where unassigned_at is null;

