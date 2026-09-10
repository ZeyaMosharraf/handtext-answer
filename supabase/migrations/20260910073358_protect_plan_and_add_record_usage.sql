-- 1) Protect profiles.plan: only the service role may change it.
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

DROP TRIGGER IF EXISTS protect_plan_column ON public.profiles;
CREATE TRIGGER protect_plan_column
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_plan_column();

-- 2) Server-side usage increment with validation.
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_user_date_unique'
  ) THEN
    ALTER TABLE public.usage
      ADD CONSTRAINT usage_user_date_unique UNIQUE (user_id, generation_date);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.record_usage(integer) TO authenticated;

-- 3) Usage becomes read-only for clients; writes only via record_usage().
DROP POLICY IF EXISTS "own usage" ON public.usage;
CREATE POLICY "own usage read"
ON public.usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.usage FROM authenticated;