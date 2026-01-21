-- Warlocks 1507 Attendance + Status (No Login)

create table if not exists students (
  id bigserial primary key,
  full_name text unique not null,
  subteam text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

/* =======================
   Task Board (Trello-light)
   ======================= */

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

-- If DB existed before archiving was added:
alter table tasks
  add column if not exists archived boolean not null default false;

create index if not exists tasks_by_subteam on tasks(subteam);
create index if not exists tasks_by_status on tasks(status);

create table if not exists task_assignments (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  unique (task_id, student_id, unassigned_at)
);

-- Helpful lookup index (not unique)
create index if not exists task_assignments_active
on task_assignments(task_id, student_id)
where unassigned_at is null;

-- Cleanup: if duplicates exist for active assignments, close out extras
with dups as (
  select
    id,
    row_number() over (
      partition by task_id, student_id
      order by assigned_at desc, id desc
    ) as rn
  from task_assignments
  where unassigned_at is null
)
update task_assignments ta
   set unassigned_at = now()
from dups
where ta.id = dups.id
  and dups.rn > 1;

-- ✅ Prevent duplicates: only ONE active assignment per (task_id, student_id)
create unique index if not exists task_assignments_active_unique
on task_assignments(task_id, student_id)
where unassigned_at is null;

create table if not exists task_comments (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  author_type text not null check (author_type in ('student','mentor')),
  author_label text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task on task_comments(task_id, created_at desc);


-- One row per student per day (upserted)
create table if not exists daily_sessions (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  meeting_date date not null default current_date,

  clock_in_at timestamptz,
  clock_out_at timestamptz,

  -- snapshot of what they said today
  subteam text,
  working_on text not null default '',

  need_help boolean not null default false,
  need_help_at timestamptz,

  need_task boolean not null default false,
  need_task_at timestamptz,

  updated_at timestamptz not null default now()
);

create unique index if not exists daily_sessions_unique
on daily_sessions(student_id, meeting_date);

create index if not exists daily_sessions_by_date
on daily_sessions(meeting_date);

create index if not exists daily_sessions_need_help
on daily_sessions(meeting_date, need_help)
where need_help = true;

create index if not exists daily_sessions_need_task
on daily_sessions(meeting_date, need_task)
where need_task = true;


/* =======================
   Attendance Corrections
   ======================= */

create table if not exists attendance_corrections (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  meeting_date date not null,
  requested_clock_in time not null,
  requested_clock_out time,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_note text
);

create index if not exists attendance_corrections_by_status
on attendance_corrections(status, meeting_date desc);

create index if not exists attendance_corrections_by_student
on attendance_corrections(student_id, meeting_date desc);


-- Add task_id column to daily_sessions if it doesn't exist
alter table daily_sessions
add column if not exists task_id bigint
references tasks(id)
on delete set null;

