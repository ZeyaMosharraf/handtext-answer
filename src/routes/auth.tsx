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
      { title: "Sign in — HandText" },
      { name: "description", content: "Sign in or create a free HandText account to generate handwritten answer sheets." },
      { property: "og:title", content: "Sign in — HandText" },
      { property: "og:description", content: "Access your handwritten answer projects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string; reset?: boolean } => {
    const next = typeof search["next"] === "string" ? search["next"] : "";
    const reset = search["reset"] === true || search["reset"] === "true";
    return {
      ...(next.startsWith("/") && !next.startsWith("//") ? { next } : {}),
      ...(reset ? { reset: true } : {}),
    };
  },
  component: AuthPage,
});

type AuthMode = "login" | "signup" | "forgot" | "reset-sent" | "update-password";

function AuthPage() {
  const { next, reset } = Route.useSearch();
  const afterAuth = () => {
    if (next) window.location.href = next;
  };
  const [mode, setMode] = useState<AuthMode>(reset ? "update-password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Listen for Supabase PASSWORD_RECOVERY event or check hash
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("update-password");
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // When logged in normally, redirect to dashboard or next target.
  // CRITICAL: Do NOT redirect away if user is in password recovery mode!
  useEffect(() => {
    if (loading || !user || mode === "update-password") return;
    if (next) {
      afterAuth();
      return;
    }
    navigate({ to: "/dashboard" });
  }, [user, loading, navigate, next, mode]);

  const submitAuth = async (e: React.FormEvent) => {
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

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          toast.error("Rate limit exceeded. Please wait a few minutes before trying again.");
        } else {
          setMode("reset-sent");
          toast.success("If an account exists, a reset link has been sent.");
        }
        return;
      }
      setMode("reset-sent");
      toast.success("Password reset email sent.");
    } catch {
      setMode("reset-sent");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully! Welcome back.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      toast.error(msg);
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
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">

          {mode === "update-password" ? (
            <div>
              <h1 className="text-xl font-bold">Set new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter and confirm your new password below.
              </p>

              <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Spinner />}
                  Update password
                </Button>
              </form>
            </div>
          ) : mode === "forgot" ? (
            <div>
              <h1 className="text-xl font-bold">Reset your password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleResetRequest} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Spinner />}
                  Send reset link
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : mode === "reset-sent" ? (
            <div>
              <h1 className="text-xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If an account exists for <strong className="text-foreground">{email}</strong>, we have sent a password reset link to your inbox. Please check your email and spam folder.
              </p>

              <div className="mt-6 space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEmail("");
                    setMode("forgot");
                  }}
                >
                  Send to a different email
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode("login")}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <div>
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

              <form onSubmit={submitAuth} className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={() => setMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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
                {mode === "login" ? "New to HandText?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
