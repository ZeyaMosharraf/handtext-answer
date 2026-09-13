# HandText — Authentication Architecture

> **User Authentication, Session Lifecycle, Recovery, and Route Guards**  
> *Target Audience:* Full-Stack Engineers, Security Auditors, AI Agents  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

---

## 1. Authentication Overview

HandText delegates identity and authentication management to **Supabase Auth (GoTrue)**. The application implements standard JWT-based session tokens with automatic token refresh, client-side route protection, OAuth redirection, and an end-to-end password recovery flow.

---

## 2. Supported Authentication Methods `[CURRENT]`

### 2.1 Email & Password
- **Registration**: Calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`. Triggers automatic `profiles` row insertion via database trigger.
- **Login**: Calls `supabase.auth.signInWithPassword({ email, password })`.

### 2.2 Google OAuth
- Initiated via `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth` } })`.
- HandText routes the OAuth callback through `/auth` to establish the session before navigating the user to `/dashboard`.

### 2.3 Password Reset & Account Recovery
- **Requesting Reset**:
  - User navigates to the "Forgot password?" view on `/auth`.
  - Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?type=recovery` })`.
  - Shows clear confirmation state without disclosing whether the email exists in the database.
- **Updating Password**:
  - The email link directs the user back to `/auth?type=recovery` with access tokens in the URL hash.
  - Supabase Auth client establishes a temporary recovery session.
  - The UI renders the password update form (New Password & Confirm Password).
  - Validates password length ($\ge 6$ characters) and confirmation match before calling `supabase.auth.updateUser({ password })`.
  - Upon success, redirects the user to `/dashboard` with a success toast: *"Your password has been updated."*

---

## 3. Route Protection & Guards `[CURRENT]`

All protected application routes live under the `_authenticated` route tree:
- `/dashboard`
- `/editor/$projectId`
- `/settings`

### Implementation: `src/routes/_authenticated/route.tsx`
```typescript
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
```

---

## 4. Route Guard & Unauthenticated Access

All protected routes under `/_authenticated` (`/dashboard`, `/editor/$projectId`, `/settings`) enforce real Supabase session authentication via `supabase.auth.getUser()`. If no active session exists or an error is returned, the router throws a redirect to `/auth`.

---

## 5. Rate-Limiting & Error Resilience

- **Supabase Auth Email Rate Limit**:
  - When Supabase Auth detects multiple signup or reset attempts within a short interval, it responds with HTTP 429: `email rate limit exceeded`.
  - The HandText UI catches this error explicitly, presenting a clear user message advising the user to wait or sign in with an existing account rather than crashing or hanging.
