# HandText — Password Reset & Recovery Email Investigation Report

> **Target Area:** Authentication & Password Recovery Flow  
> **Investigation Date:** September 20, 2026  
> **Status:** Root Cause Analysis Complete (No code or dashboard modifications applied)

---

## 1. Current Implementation

### 1.1 Triggering Password Reset (`handleResetRequest`)
In [`src/routes/auth.tsx`](file:///d:/handtext-answer/src/routes/auth.tsx) (lines 112–139):
```typescript
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
```

### 1.2 Route & Search Validation
In [`src/routes/auth.tsx`](file:///d:/handtext-answer/src/routes/auth.tsx) (lines 20–27):
```typescript
validateSearch: (search: Record<string, unknown>): { next?: string; reset?: boolean } => {
  const next = typeof search["next"] === "string" ? search["next"] : "";
  const reset = search["reset"] === true || search["reset"] === "true";
  return {
    ...(next.startsWith("/") && !next.startsWith("//") ? { next } : {}),
    ...(reset ? { reset: true } : {}),
  };
},
```

### 1.3 State Initialization
In [`src/routes/auth.tsx`](file:///d:/handtext-answer/src/routes/auth.tsx) (line 38):
```typescript
const [mode, setMode] = useState<AuthMode>(reset ? "update-password" : "login");
```

---

## 2. Actual Redirect URL

When `supabase.auth.resetPasswordForEmail` is called:
- **On Localhost:**
  `http://localhost:3000/auth?reset=true` (or whichever local port Vite/Nitro is using, e.g. `http://localhost:5173/auth?reset=true`)
- **On Production:**
  `https://handtext-answer.vercel.app/auth?reset=true`

### The Flow of Tokens:
1. Client passes `redirectTo: ${window.location.origin}/auth?reset=true` to Supabase GoTrue endpoint (`POST /auth/v1/recover`).
2. Supabase verifies if `redirectTo` matches its allowed redirect URLs.
3. Supabase constructs the verification link embedded in `{{ .ConfirmationURL }}`:
   `https://<project-ref>.supabase.co/auth/v1/verify?token=<token>&type=recovery&redirect_to=<redirectTo>`
4. When the user clicks the link in the email, the browser reaches Supabase GoTrue.
5. Supabase exchanges the one-time token and issues an HTTP 303 redirect to:
   `https://handtext-answer.vercel.app/auth?reset=true#access_token=<JWT>&refresh_token=<JWT>&type=recovery`

---

## 3. Recovery-Session Handling

In [`src/routes/auth.tsx`](file:///d:/handtext-answer/src/routes/auth.tsx):
1. **Hash & Event Detection (lines 48–63):**
   ```typescript
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
   ```
2. **Dashboard Guard Prevention (lines 65–74):**
   ```typescript
   useEffect(() => {
     if (loading || !user || mode === "update-password") return;
     if (next) {
       afterAuth();
       return;
     }
     navigate({ to: "/dashboard" });
   }, [user, loading, navigate, next, mode]);
   ```
3. **Updating the Password (lines 141–163):**
   Calls `supabase.auth.updateUser({ password: newPassword })`, displays a success toast, and navigates to `/dashboard`.

---

## 4. Production Redirect Configuration

- Application origin: `https://handtext-answer.vercel.app`
- Callback path requested: `/auth?reset=true`
- **Supabase Auth requirement:**
  Under **Supabase Dashboard -> Authentication -> URL Configuration**:
  - **Site URL:** Should be set to `https://handtext-answer.vercel.app`
  - **Redirect URLs (Allow List):** Must contain wildcards covering all paths and query parameters:
    - `https://handtext-answer.vercel.app/**`

> [!WARNING]
> If Supabase's Redirect URLs list only has `https://handtext-answer.vercel.app` or `https://handtext-answer.vercel.app/auth` (without `/**` wildcard), Supabase's URL validator may reject the query parameter `?reset=true` and fall back to the default Site URL (`/`), landing the user on the home page instead of the password update screen.

---

## 5. Localhost Redirect Configuration

- Dynamic origin on local dev: `http://localhost:3000` or `http://localhost:5173` or `http://127.0.0.1:3000`
- Callback path requested: `/auth?reset=true`
- **Supabase Auth requirement:**
  Because the frontend dynamically uses `window.location.origin`, local testing requires the local dev origins to be explicitly listed in Supabase's **Redirect URLs** allow list:
  - `http://localhost:3000/**`
  - `http://localhost:5173/**`
  - `http://127.0.0.1:3000/**`

---

## 6. Supabase Email Configuration Dependency (Crucial Architecture Separation)

### A. Application Code (Frontend)
- The frontend **only** requests Supabase to dispatch a reset email via `supabase.auth.resetPasswordForEmail()`.
- The frontend **never** configures, stores, or touches SMTP credentials, email templates, sender addresses, or email servers.

### B. Supabase Auth Email Delivery (Backend/Cloud)
- All actual email dispatching happens inside **Supabase Cloud (GoTrue)**.
- **Default Supabase Email Service (Inherent Bottleneck):**
  - Uses `noreply@mail.app.supabase.io`.
  - **Hard rate limit:** Only **3 to 4 emails per hour** for the entire project.
  - Frequent deliverability failures: Emails sent via the default pool often land in Spam/Junk or get outright dropped by major mail providers (Gmail, Outlook, iCloud) due to lack of custom DKIM/SPF domain verification.
- **Production Requirement:**
  - In **Supabase Dashboard -> Project Settings -> Authentication -> SMTP Settings**, a custom SMTP provider (such as Resend, Brevo, SendGrid, Postmark, or Amazon SES) **must be enabled** with custom sender credentials and domain records.

---

## 7. Email Template Dependency

The email template lives exclusively in **Supabase Dashboard -> Authentication -> Email Templates -> Reset Password**.

The default and correct template is:
```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

> [!IMPORTANT]
> The link **must** use `{{ .ConfirmationURL }}`.  
> If the template was manually edited to use a static URL (e.g. `<a href="https://handtext-answer.vercel.app/auth?type=recovery">`) or `{{ .SiteURL }}`, the verification token is never passed to Supabase GoTrue, meaning no session token is ever issued and the user will arrive at an unauthenticated page where password updates fail.

---

## 8. Documentation Mismatch

In [`docs/AUTHENTICATION.md`](file:///d:/handtext-answer/docs/AUTHENTICATION.md) (line 29) and [`docs/PROJECT_CONTEXT.md`](file:///d:/handtext-answer/docs/PROJECT_CONTEXT.md) (line 318):
- Documented: `redirectTo: ${window.location.origin}/auth?type=recovery`
- Actual Code: `redirectTo: ${window.location.origin}/auth?reset=true`

### Why this mismatch exists:
- Early architectural documentation proposed `type=recovery` as a query parameter.
- When implemented in `src/routes/auth.tsx`, the author used `?reset=true` to drive the initial state `mode = reset ? "update-password" : "login"`, while checking `window.location.hash.includes("type=recovery")` for the Supabase token hash.
- The documentation was not updated to reflect `reset=true`.

### Risk of the Mismatch:
In `src/routes/auth.tsx`:
- `validateSearch` currently **only** validates `reset?: boolean`.
- If an email template or external link sends a query parameter `?type=recovery`, `validateSearch` ignores it. `mode` initializes to `"login"`.
- Although `onAuthStateChange` eventually fires with `"PASSWORD_RECOVERY"` to set `mode = "update-password"`, there is an asynchronous race condition where `useAuth()` could resolve `user` before the event handler runs, causing the guard to prematurely redirect the user to `/dashboard`!

---

## 9. Exact Root Cause

There are two distinct root causes behind password reset issues:

### Root Cause 1 (Email Delivery): Supabase Built-in Email Rate-Limiting & Filtering
1. The project relies on Supabase's default shared SMTP pool.
2. If more than 3 requests are triggered within an hour (common during local dev and testing), Supabase silently stops delivering or returns rate limit errors.
3. Emails that are dispatched are frequently routed to the user's Spam/Junk folder because `noreply@mail.app.supabase.io` lacks reputation for the app.

### Root Cause 2 (Application & Configuration Mismatch): Potential Allowlist or Query Drop
1. **Redirect Allow List:** If the Supabase Dashboard only whitelists `https://handtext-answer.vercel.app` without the `/**` wildcard, the callback URL `https://handtext-answer.vercel.app/auth?reset=true` is deemed unauthorized, causing Supabase to fall back to the root Site URL (`/`) and discarding the reset destination.
2. **Search Parameter Fragility:** `auth.tsx` only accepts `reset=true` in `validateSearch`. It does not recognize `type=recovery` in query parameters despite `AUTHENTICATION.md` specifying it.

---

## 10. Exact Recommended Fix

### Step 1: Code Hardening (When Authorized)
Update `src/routes/auth.tsx`:
1. Expand `validateSearch` to accept **both** `reset=true` and `type=recovery`:
   ```typescript
   validateSearch: (search: Record<string, unknown>): { next?: string; reset?: boolean; type?: string } => {
     const next = typeof search["next"] === "string" ? search["next"] : "";
     const reset = search["reset"] === true || search["reset"] === "true" || search["type"] === "recovery";
     const type = typeof search["type"] === "string" ? search["type"] : undefined;
     return {
       ...(next.startsWith("/") && !next.startsWith("//") ? { next } : {}),
       ...(reset ? { reset: true } : {}),
       ...(type ? { type } : {}),
     };
   }
   ```
2. Initialize `mode` to `"update-password"` if `reset === true` or `search.type === "recovery"` or if `window.location.hash.includes("type=recovery")`.
3. Update `docs/AUTHENTICATION.md` and `docs/PROJECT_CONTEXT.md` to document the unified recovery URL handling.

### Step 2: Supabase Dashboard Configuration (External)
1. In **Authentication -> URL Configuration**:
   - Set **Site URL** to: `https://handtext-answer.vercel.app`
   - Add to **Redirect URLs**:
     - `https://handtext-answer.vercel.app/**`
     - `http://localhost:3000/**`
     - `http://localhost:5173/**`
2. In **Authentication -> Email Templates -> Reset Password**:
   - Ensure the template uses `<a href="{{ .ConfirmationURL }}">Reset Password</a>`.
3. In **Project Settings -> Authentication -> SMTP Settings**:
   - Enable Custom SMTP (e.g. Resend, Brevo, SendGrid) to eliminate the 3 emails/hour rate limit and guarantee inbox delivery.

---

## 11. Files That Need Changing (When Ready to Implement)

1. [`src/routes/auth.tsx`](file:///d:/handtext-answer/src/routes/auth.tsx) — Accept both `reset=true` and `type=recovery` in `validateSearch` to make route handling bulletproof against any redirect format.
2. [`docs/AUTHENTICATION.md`](file:///d:/handtext-answer/docs/AUTHENTICATION.md) — Clarify that both `reset=true` and `type=recovery` are supported.
3. [`docs/PROJECT_CONTEXT.md`](file:///d:/handtext-answer/docs/PROJECT_CONTEXT.md) — Synchronize password reset architecture documentation.

*(No code in `src/` has been modified yet.)*

---

## 12. Supabase Dashboard Settings That Need Checking

| Setting Screen | Setting Name | Required Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Authentication -> URL Configuration** | **Site URL** | `https://handtext-answer.vercel.app` | Default base redirect for auth operations |
| **Authentication -> URL Configuration** | **Redirect URLs** | `https://handtext-answer.vercel.app/**`<br>`http://localhost:3000/**`<br>`http://localhost:5173/**` | Authorizes dynamic redirects with query params and tokens |
| **Authentication -> Email Templates** | **Reset Password** | `<a href="{{ .ConfirmationURL }}">...</a>` | Must point to GoTrue verification endpoint |
| **Project Settings -> Auth -> SMTP** | **Enable Custom SMTP** | Checked (with custom provider) | Removes 3/hour rate-limit and ensures inbox delivery |

---

## 13. Browser Test Plan

### Test Case 1: Localhost End-to-End Recovery Flow
1. Open local app (`http://localhost:3000/auth` or dev server).
2. Click **Forgot password?**.
3. Enter test user email and click **Send reset link**.
4. Check inbox (or console if running local GoTrue).
5. Verify the received email link contains `http://localhost:3000/auth?reset=true` in `redirect_to`.
6. Click link. Verify browser opens `http://localhost:3000/auth?reset=true#access_token=...&type=recovery`.
7. Verify page immediately displays **"Set new password"** (not login, and no premature redirect to `/dashboard`).
8. Enter and confirm new password (min 6 chars), submit form.
9. Verify toast: *"Password updated successfully! Welcome back."* and navigation to `/dashboard`.
10. Log out and log in with the new password to confirm validity.

### Test Case 2: Production End-to-End Recovery Flow
1. Open `https://handtext-answer.vercel.app/auth`.
2. Follow the same flow as above.
3. Confirm the email link redirects to `https://handtext-answer.vercel.app/auth?reset=true#access_token=...`.
4. Confirm successful password update and redirect to `/dashboard`.

### Test Case 3: Backward-Compatibility with `?type=recovery`
1. Manually navigate to `http://localhost:3000/auth?type=recovery#access_token=mock&type=recovery`.
2. Confirm the page renders the **"Set new password"** form directly without errors.
