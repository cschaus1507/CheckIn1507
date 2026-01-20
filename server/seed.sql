-- Seed students for Warlocks 1507
-- Safe to run multiple times (idempotent)

insert into students (full_name, subteam, is_active)
values
  ('Alana Davis', 'General', true),
  ('Andre Shotell', 'General', true),
  ('Andrew Stirling', 'General', true),
  ('Benjamin Potocki', 'General', true),
  ('Caden Edwards', 'General', true),
  ('Carson White', 'General', true),
  ('Dakari Richards', 'General', true),
  ('Gavyn Schaus', 'General', true),
  ('Gianna Lewis', 'General', true),
  ('Harlee Miner', 'General', true),
  ('Isabelle Wyant', 'General', true),
  ('Jack Martinello', 'General', true),
  ('Jacob Schmidt', 'General', true),
  ('Joseph Simons', 'General', true),
  ('Katelynn Dang', 'General', true),
  ('Lee Carr', 'General', true),
  ('Lucas Zumaeta', 'General', true),
  ('Lumia Sung', 'General', true),
  ('Nathan McDonough', 'General', true),
  ('Nathaniel Lambalzer', 'General', true),
  ('Riley Vaccaro', 'General', true),
  ('Sebastian Wrobel', 'General', true),
  ('Shawn Stuart', 'General', true),
  ('Test Student', 'General', true),
  ('Theo Love', 'General', true),
  ('Trevor Skerrett', 'General', true),
  ('William Colley', 'General', true),
  ('William Mitchell', 'General', true)
on conflict (full_name) do update
set
  subteam = excluded.subteam,
  is_active = true;

