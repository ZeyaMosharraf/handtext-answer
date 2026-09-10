import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/SiteHeader";
import { Button, Card, Input, Label, Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/hooks/useAuth";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HandText AI" },
      { name: "description", content: "Sign in or create a free HandText AI account to generate handwritten answer sheets." },
      { property: "og:title", content: "Sign in — HandText AI" },
      { property: "og:description", content: "Access your handwritten answer projects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = typeof search["next"] === "string" ? search["next"] : "";
    return next.startsWith("/") && !next.startsWith("//") ? { next } : {};
  },
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const afterAuth = () => {
    if (next) window.location.href = next;
  };
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  }, [user, loading, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next || "/dashboard"}`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      if (next) {
        afterAuth();
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast.error(message.includes("Invalid login") ? "That email or password doesn't match." : message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(next || "/dashboard")}` },
    });
    if (error) {
      setBusy(false);
      toast.error("Google sign-in didn't work. Please try again or use your email.");
    }
    // On success the browser redirects to Google; nothing more to do here.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to open your handwritten answer projects."
              : "Free to start — no card needed."}
          </p>

          <Button variant="outline" className="mt-5 w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to HandText AI?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
