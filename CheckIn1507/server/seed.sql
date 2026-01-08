-- Optional: seed roster (edit names!)
insert into students (full_name, subteam)
values
  ('Sample Student 1', 'Mechanical'),
  ('Sample Student 2', 'Programming'),
  ('Sample Student 3', 'Electrical')
on conflict (full_name) do nothing;
