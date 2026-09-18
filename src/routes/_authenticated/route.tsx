import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (import.meta.env.DEV) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) return { user: data.user };
      } catch {
        // ignore auth error in dev
      }
      return {
        user: {
          id: "dev-test-user",
          email: "dev@handtext.local",
          app_metadata: {},
          user_metadata: { full_name: "Dev Tester" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as any,
      };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
