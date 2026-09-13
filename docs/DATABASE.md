# HandText — Database Architecture & Schema Reference

> **Supabase PostgreSQL Schema, Security Model, RLS Policies, and Database RPCs**  
> *Target Audience:* Backend Engineers, Database Administrators, Security Auditors, AI Agents  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical  
> *Active Project Ref:* `aojpzcmwretmknftvzde` (`https://aojpzcmwretmknftvzde.supabase.co`)

---

## 1. Database Overview

HandText uses **PostgreSQL 15+** managed via Supabase. The database architecture is built around three core principles:
1. **Zero-Trust Client Access via RLS**: Every public table has Row Level Security (RLS) enabled. Clients are restricted to records where the owner column matches `auth.uid()`.
2. **Immutability of Privileged Data**: Billing plans (`profiles.plan`) and usage counters (`public.usage`) cannot be directly manipulated by client-side queries. They are protected by triggers and server-side `SECURITY DEFINER` functions.
3. **Foreign Key Integrity**: All user-related records cascade delete with `auth.users`.

---

## 2. Table Specifications `[CURRENT]`

### 2.1 Table: `public.profiles`
Stores user settings, default stationery preferences, and subscription plan tiers.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  default_style TEXT NOT NULL DEFAULT 'natural',
  default_ink TEXT NOT NULL DEFAULT 'blue',
  default_page TEXT NOT NULL DEFAULT 'a4-ruled',
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Column Details
- `id`: Matches `auth.users.id`.
- `plan`: Subscription tier (`free`, `student`, `pro`). **Clients cannot modify this column.**
- `default_style`, `default_ink`, `default_page`: Defaults applied when creating new projects.

---

### 2.2 Table: `public.projects`
Stores user documents, questions, rich HTML text content, and serialized handwriting configuration.

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled answer',
  question TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_user_updated_idx
ON public.projects (user_id, updated_at DESC);
```

#### Column Details
- `id`: Unique project UUID.
- `user_id`: Owning user reference (`auth.users.id`).
- `name`: Human-readable document title.
- `question`: Assignment prompt string (used in Assignment Mode).
- `content`: Document body stored as rich HTML string (e.g., `<p>Text with <span data-color="...">styles</span></p>`).
- `settings`: Complete JSONB serialization of `HandwritingSettings` (paper kind, rulings, margins, font physics, header/footer bands).
- `page_count`: Cached count of physical pages generated during the last generation run.
- `status`: Lifecycle indicator (`draft` | `generated`).

---

### 2.3 Table: `public.usage`
Records page generation activity per user per calendar day to enforce monthly usage limits.

```sql
CREATE TABLE public.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pages_generated INTEGER NOT NULL DEFAULT 0,
  generation_date DATE NOT NULL DEFAULT current_date,
  CONSTRAINT usage_user_date_unique UNIQUE (user_id, generation_date)
);
```

#### Column Details
- `user_id`: Reference to user.
- `pages_generated`: Daily accumulator for generated handwritten pages.
- `generation_date`: Calendar date of generation (`CURRENT_DATE`).
- `usage_user_date_unique`: Ensures exactly one row per user per calendar day.

---

## 3. Database Functions & Triggers `[CURRENT]`

### 3.1 Automatic Profile Creation: `handle_new_user()`
Automatically provisions a `profiles` row whenever a new user registers in Supabase Auth.

```sql
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
```

---

### 3.2 Timestamp Management: `set_updated_at()`
Ensures `updated_at` timestamps update on every record modification.

```sql
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
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### 3.3 Plan Protection: `protect_plan_column()`
Enforces security at the database engine level so client applications cannot escalate their own subscription plan.

```sql
CREATE OR REPLACE FUNCTION public.protect_plan_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  IF NEW.plan IS DISTINCT FROM OLD.plan
     AND (jwt_role IS NULL OR jwt_role <> 'service_role') THEN
    RAISE EXCEPTION 'plan can only be changed by the server';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_plan_column
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_plan_column();
```

---

### 3.4 Safe Usage Recording: `record_usage()`
Secure RPC enabling authenticated clients to record page generation without having direct write permissions on the `usage` table.

```sql
CREATE OR REPLACE FUNCTION public.record_usage(p_pages integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_pages IS NULL OR p_pages < 1 OR p_pages > 200 THEN
    RAISE EXCEPTION 'invalid page count';
  END IF;
  INSERT INTO public.usage (user_id, pages_generated, generation_date)
  VALUES (auth.uid(), p_pages, CURRENT_DATE)
  ON CONFLICT (user_id, generation_date)
  DO UPDATE SET pages_generated = public.usage.pages_generated + EXCLUDED.pages_generated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_usage(integer) TO authenticated;
```

---

## 4. Row Level Security (RLS) & Permissions Matrix `[CURRENT]`

| Table | Operation | Target Role | RLS Policy Definition / Constraint |
| :--- | :--- | :--- | :--- |
| `profiles` | SELECT | `authenticated` | `USING (auth.uid() = id)` |
| `profiles` | UPDATE | `authenticated` | Column grant restricted to `(email, full_name, avatar_url, default_style, default_ink, default_page)`. `plan` excluded. |
| `profiles` | INSERT/DELETE | `authenticated` | **REVOKED**. Creation handled exclusively by `handle_new_user()` trigger. |
| `projects` | SELECT | `authenticated` | `USING (auth.uid() = user_id)` |
| `projects` | INSERT | `authenticated` | `WITH CHECK (auth.uid() = user_id)` |
| `projects` | UPDATE | `authenticated` | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `projects` | DELETE | `authenticated` | `USING (auth.uid() = user_id)` |
| `usage` | SELECT | `authenticated` | `USING (auth.uid() = user_id)` |
| `usage` | INSERT/UPDATE/DELETE | `authenticated` | **REVOKED**. Direct client writes blocked; writes occur solely through `record_usage()` RPC. |
| *All* | ALL | `service_role` | Unrestricted bypass for administrative tasks. |
| *All* | ALL | `anon` | **REVOKED**. Zero public access. |

---

## 5. Known Save Issue & Resolution History

### Symptom: HTTP 406 "Not Acceptable" on Project Save
During previous development phases, explicit saves via <kbd>Ctrl</kbd>+<kbd>S</kbd> to `public.projects` intermittently failed with an HTTP 406 error.

### Root Cause Analysis
Two factors combined to cause this failure:
1. **Missing RLS UPDATE Policy on Remote Database**: While local migrations specified update privileges, the live Supabase instance was missing an explicit `FOR UPDATE` RLS policy granting authenticated users permission to update their rows.
2. **PostgREST `.single()` Assertion**: PostgREST's `.single()` method requires exactly one row to be returned with `Content-Type: application/vnd.pgrst.object+json`. When the database rejected the update due to RLS, PostgREST returned 0 rows, triggering an HTTP 406 response.

### Applied Resolution (Migration `20260911100500_grant_update_on_projects.sql`)
1. Executed explicit SQL grant and policy on the live database:
   ```sql
   GRANT UPDATE ON public.projects TO authenticated;

   DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
   CREATE POLICY "Users can update own projects"
   ON public.projects
   FOR UPDATE
   TO authenticated
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id);
   ```
2. Updated client query in `src/lib/projects.ts` from `.single()` to `.maybeSingle()` with an explicit null check:
   ```typescript
   const { data, error } = await supabase
     .from("projects")
     .update(patch)
     .eq("id", id)
     .select("*")
     .maybeSingle();

   if (error) throw error;
   if (!data) {
     throw new Error("Project not found or update permission denied");
   }
   return normalise(data);
   ```
This resolution is verified and permanently active in the live environment.
