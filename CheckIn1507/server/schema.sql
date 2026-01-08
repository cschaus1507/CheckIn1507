-- Warlocks 1507 Attendance + Status (No Login)

create table if not exists students (
  id bigserial primary key,
  full_name text unique not null,
  subteam text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

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
