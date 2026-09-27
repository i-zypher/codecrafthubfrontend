/*
# Create courses table (single-tenant, no auth)

1. New Tables
- `courses`
  - `id` (uuid, primary key, auto-generated)
  - `title` (text, not null) — the course name
  - `description` (text) — a short description of the course
  - `instructor` (text) — the instructor's name
  - `category` (text) — course category/subject area
  - `duration_weeks` (integer) — how many weeks the course runs
  - `level` (text) — difficulty level (Beginner, Intermediate, Advanced)
  - `created_at` (timestamp, defaults to now)

2. Security
- Enable RLS on `courses`.
- Allow anon + authenticated full CRUD because this is a single-tenant app with no sign-in screen.
- All data is intentionally shared/public.
*/

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor text,
  category text,
  duration_weeks integer DEFAULT 4,
  level text DEFAULT 'Beginner',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_courses" ON courses;
CREATE POLICY "anon_select_courses" ON courses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_courses" ON courses;
CREATE POLICY "anon_insert_courses" ON courses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_courses" ON courses;
CREATE POLICY "anon_update_courses" ON courses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_courses" ON courses;
CREATE POLICY "anon_delete_courses" ON courses FOR DELETE
  TO anon, authenticated USING (true);
