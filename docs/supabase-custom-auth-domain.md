# Supabase custom auth domain — `auth.oscrsj.com`

**Status:** runbook only — not yet executed. Ship Session 8, execution deferred to when Kanwar confirms Supabase plan + Workspace email.

**Why this exists.** Supabase's default auth domain is `<project-ref>.supabase.co`. Every confirmation email, password-reset link, and magic-link redirect rendered to users currently points at that subdomain. A custom domain (`auth.oscrsj.com`) keeps the OSCRSJ brand in every auth-flow URL and avoids the "why is this `.supabase.co` link from a journal?" trust hit with new signups.

---

## 0. Preconditions to verify first

Custom auth domains are a **paid-plan feature**. Before starting, confirm the Supabase plan in the dashboard → Project Settings → Billing.

- **Free tier** → custom auth domain is **not available**. Upgrade to **Pro (~$25/month)** or stop here.
- **Pro or higher** → proceed.

If Kanwar is currently on Free and does not want to upgrade this cycle, ship the decision as a Decision Session entry and revisit after revenue picks up. Do not silently eat the $25/month.

---

## 1. Add the DNS record in GoDaddy

1. Log into GoDaddy → domain portfolio → `oscrsj.com` → DNS management.
2. Add a new **CNAME** record:
   - **Host / Name:** `auth`
   - **Points to / Value:** `<project-ref>.supabase.co` — the exact hostname Supabase gives you in the next step. Supabase will surface this when you initiate the custom domain setup; check the dashboard first so you paste the correct target.
   - **TTL:** 1 hour (3600s) is fine.
3. Save. GoDaddy caches aggressively; allow up to 30 minutes for propagation.

Verify with:

```bash
dig +short auth.oscrsj.com CNAME
# should return something like:
#   <project-ref>.supabase.co.
```

---

## 2. Register the custom domain in Supabase

1. Supabase dashboard → Project Settings → **Auth** → Custom Domains (tab may be labeled "Custom Auth Domain" depending on dashboard version).
2. Enter `auth.oscrsj.com` → Save.
3. Supabase issues an ACM/Let's Encrypt certificate for the domain. This typically takes 1–5 minutes after the CNAME resolves. The dashboard shows the cert status inline.
4. Once the dashboard shows "Active" / "Verified", proceed.

---

## 3. Update the Site URL + redirect allowlist

Still in Supabase → Project Settings → Auth → **URL Configuration**:

- **Site URL:** leave as `https://www.oscrsj.com` (this is the product app URL, unchanged).
- **Additional Redirect URLs:** ensure these are present:
  - `https://www.oscrsj.com/auth/callback`
  - `https://www.oscrsj.com/auth/callback/orcid`
  - `https://www.oscrsj.com/reset-password`

The custom auth domain only changes the host serving `/auth/v1/*` and the links inside auth emails — it does not change which URLs Supabase is allowed to redirect users to after they click through.

---

## 4. Update the email templates

Supabase dashboard → Auth → **Email Templates**. For each of the three live templates (Confirm Signup, Magic Link, Reset Password):

1. Locate the `{{ .ConfirmationURL }}` (or equivalent) placeholder in the template body.
2. If the template hard-codes the Supabase host anywhere (older projects sometimes do), replace it with the new custom host. Newer Supabase projects use `{{ .SiteURL }}` + relative paths and will pick up the change automatically once the custom domain is active.
3. Save each template.
4. Trigger a test send from the template preview to confirm the generated link points at `https://auth.oscrsj.com/auth/v1/verify?token=...` rather than `https://<project-ref>.supabase.co/...`.

---

## 5. Verification

From a terminal:

```bash
curl -sI https://auth.oscrsj.com/auth/v1/health
# expect: HTTP/2 200 ... with a valid TLS cert for auth.oscrsj.com
```

Then end-to-end:

1. Open an incognito window → https://www.oscrsj.com/register.
2. Register with a throwaway plus-addressed Gmail (e.g. `kanwarparhar+customauth1@gmail.com`).
3. Open the confirmation email. The confirmation link should now point at `https://auth.oscrsj.com/auth/v1/verify?...`.
4. Click the link. It should bounce through Supabase at the new host and land at `https://www.oscrsj.com/dashboard`.
5. Delete the throwaway user from Supabase → Authentication → Users when done.

If any step fails, the rollback is safe: Supabase will fall back to the default `<project-ref>.supabase.co` domain the moment the custom domain is removed from the dashboard. The app code does not care which auth host Supabase serves from.

---

## What the app code knows about this

**Nothing.** The auth flow runs entirely through `@supabase/ssr` and reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel env. Those point at the API host, not the auth-emails host. Changing the auth domain is purely a Supabase dashboard + DNS operation — no code change, no redeploy.

If you ever find the app code referencing `auth.oscrsj.com` explicitly, that's a smell: put the URL back in environment config or remove the reference.

---

## Decision checkpoints for Kanwar

- [ ] Is OSCRSJ on Supabase Pro yet? If yes → run this runbook end-to-end. If no → file a decision entry and revisit after LLC + revenue checkpoints.
- [ ] Has `editorial@oscrsj.com` been provisioned in Google Workspace? Independent of this runbook, but tends to ship together — a branded `auth.oscrsj.com` confirmation link from a `noreply@auth.oscrsj.com` sender reads much better than the current mix.
