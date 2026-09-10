-- ============================================================
-- HANDTEXT DATABASE SCHEMA
-- Production-oriented permissions + RLS
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,

  email TEXT,
  full_name TEXT,
  avatar_url TEXT,

  default_style TEXT NOT NULL DEFAULT 'natural',
  default_ink TEXT NOT NULL DEFAULT 'blue',
  default_page TEXT NOT NULL DEFAULT 'a4-ruled',

  -- IMPORTANT:
  -- Users must NOT be allowed to change their own plan.
  plan TEXT NOT NULL DEFAULT 'free',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- Users can only see their own profile.
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

GRANT SELECT ON public.profiles TO authenticated;


-- Users can update only normal profile/preferences fields.
-- plan is intentionally NOT included.
GRANT UPDATE (
  email,
  full_name,
  avatar_url,
  default_style,
  default_ink,
  default_page
)
ON public.profiles
TO authenticated;


-- Users don't need direct INSERT/DELETE access.
-- The profile is created automatically by the auth trigger.


-- Server-side/service-role access.
GRANT ALL ON public.profiles TO service_role;


-- ============================================================
-- 2. PROJECTS
-- ============================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT 'Untitled answer',
  question TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- These are application-controlled values.
  page_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;


-- Users can only access their own projects.
CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


CREATE POLICY "Users can create own projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);


CREATE POLICY "Users can delete own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- Allow authenticated users to view their own projects
GRANT SELECT ON public.projects TO authenticated;

-- Allow authenticated users to insert their own projects
GRANT INSERT ON public.projects TO authenticated;

-- Allow authenticated users to delete their own projects
GRANT DELETE ON public.projects TO authenticated;

-- Users can edit project content, settings, page_count, and status.
GRANT UPDATE (
  name,
  question,
  content,
  settings,
  page_count,
  status
)
ON public.projects
TO authenticated;


-- Server-side/service-role access.
GRANT ALL ON public.projects TO service_role;


CREATE INDEX projects_user_updated_idx
ON public.projects (user_id, updated_at DESC);


-- ============================================================
-- 3. USAGE
-- ============================================================

CREATE TABLE public.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  pages_generated INTEGER NOT NULL DEFAULT 0,
  generation_date DATE NOT NULL DEFAULT current_date,

  UNIQUE (user_id, generation_date)
);

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;


-- Users may READ their own usage.
CREATE POLICY "Users can view own usage"
ON public.usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- IMPORTANT:
-- No INSERT / UPDATE / DELETE permission for authenticated users.
--
-- Usage changes must happen through trusted server-side code.


GRANT SELECT ON public.usage TO authenticated;

GRANT ALL ON public.usage TO service_role;


-- ============================================================
-- 4. UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql
SET search_path = public;


CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. AUTOMATIC PROFILE CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

END;
$$;


CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();