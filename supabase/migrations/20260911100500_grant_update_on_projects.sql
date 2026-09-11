-- ============================================================
-- Fix: Grant UPDATE privilege and add missing UPDATE policy
-- for public.projects table.
-- ============================================================

-- 1. Grant table-level UPDATE privilege on public.projects to authenticated users
GRANT UPDATE ON public.projects TO authenticated;

-- 2. Add UPDATE policy allowing authenticated users to update only their own projects
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;

CREATE POLICY "Users can update own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
