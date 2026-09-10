import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// TODO: TEMPORARY AUTH BYPASS FOR UI DEVELOPMENT.
// Set to false before enabling production authentication.
const TEMP_DISABLE_AUTH = true;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (TEMP_DISABLE_AUTH) {
      return { user: null };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
