# CreatorX

CreatorX is a full-stack influencer marketing platform with two surfaces:

- **Creator web app** — mobile-first (480px column), dark theme, everything a creator needs: Discover campaigns, Apply, My Campaigns, Inbox with chat, Earnings + Withdraw, Profile + Settings, Community Hub (events / perks / news), and Notifications.
- **Admin console** — desktop sidebar layout that lets operators moderate the whole platform: Dashboard KPIs, Creators, Brands, Campaigns, Applications, Deliverables, Payouts, Community, and Audit Log.

The build follows the 17-screen Stitch design language: royal blue `#1337ec` primary on a near-black surface (`#050505` / `#121212`), Plus Jakarta Sans display + Noto Sans body, Material Symbols icons, rounded 2xl/3xl cards, glowing primary CTAs.

---

## Quick start

```bash
npm install
npm run dev          # Express + Vite on http://localhost:5000
```

Open `http://localhost:5000/`. You will land on a 3-slide onboarding carousel → **Log in** → pick a demo user.

### Demo users

| Email | Role | Notes |
| --- | --- | --- |
| `alex@creatorx.app` | creator | Verified Pro · 1.2M reach · $12k earned · $2,530 balance |
| `maya@creatorx.app` | creator | Verified Pro |
| `jordan@creatorx.app` | creator | Starter |
| `lina@creatorx.app` | creator | Starter |
| `admin@creatorx.app` | admin | CreatorX admin console |

You can also deep-link with a uid query param, e.g.
`http://localhost:5000/?uid=creator-alex#/home` or
`http://localhost:5000/?uid=admin-root#/admin`.

---

## Architecture

```
client/       React + wouter (hash routing) + TanStack Query + Tailwind + shadcn/ui
server/       Express + typed REST under /api/*
shared/       Single source of truth: schema.ts (types) shared by client + server
supabase/     Production migration + RLS policies (run when you wire Supabase)
```

### Mock backend

- Data lives in `/tmp/creatorx-db.json` (plain JSON, auto-seeded on first boot from `server/seed.ts`).
- `server/storage.ts` exposes CRUD modules (`profiles`, `brands`, `campaigns`, `applications`, `deliverables`, `messages`, `transactions`, `withdrawals`, `community`, `notifications`, `audit`) plus `analytics.summary()` for the admin dashboard.
- All REST routes are defined in `server/routes.ts`. Every request identifies the user via the `X-User-Id` header (or `?uid=` query param as a fallback — the sandboxed deployment iframe blocks `localStorage`, so we thread the uid through the URL).
- **Reset the mock DB at any time:** `POST /api/admin/reset` or restart the server after deleting `/tmp/creatorx-db.json`.

### Data model

See `packages/schema/src/schema.ts` — one TypeScript interface per table. The Supabase migrations in `supabase/migrations/` mirror these 1:1.

---

## Swapping in Supabase

The mock backend was designed so the only file that changes is `server/storage.ts`. The client, types, and REST shape stay identical.

### 1. Run the migration

In your Supabase project → **SQL editor** → run the Drizzle-generated SQL in `supabase/migrations/`. These migrations create the current tables, enums, defaults, and foreign keys from `packages/schema/src/schema.ts`.

### 2. Add env vars

```bash
# .env (server-side)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server only — never ship to client

# client-side (Vite picks up VITE_* only)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Swap `server/storage.ts`

Replace the JSON-file implementation with `@supabase/supabase-js`. The exported interface stays the same — every route in `server/routes.ts` keeps working unchanged. Sketch:

```ts
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const profiles = {
  async get(id: string) {
    const { data } = await sb.from("profiles").select("*").eq("id", id).single();
    return data;
  },
  async list() {
    const { data } = await sb.from("profiles").select("*");
    return data ?? [];
  },
  // ...update / delete mirror the mock methods
};
```

Do the same for every module. Arrays (`niches`, `tags`, `platforms`, `dos`, `donts`) map to native Postgres `text[]`. The nested `deliverables` on `campaigns` is `jsonb`.

### 4. Wire auth

- Drop the dev `setCurrentUserId` flow in `client/src/lib/auth.tsx`.
- Mount `@supabase/auth-helpers-react` at the app root and use `useSession()` / `useUser()`.
- Send `Authorization: Bearer <supabase access_token>` from `client/src/lib/queryClient.ts` — remove the `X-User-Id` header. The server should verify the JWT (via `@supabase/supabase-js` with the anon key) and derive `user_id` from `auth.uid()`.

### 5. Storage (file uploads)

Deliverable assets, avatars, and campaign covers should move from the placeholder URLs to a Supabase Storage bucket (e.g. `public/avatars`, `private/deliverables`). Policies:
- `avatars` — public read, owner write.
- `deliverables` — authenticated read (creator + admin), owner write.

---

## Deployment

The `server/index.ts` script serves the Vite-built client and the Express API from a single Node process.

```bash
npm run build                                  # emits dist/public + dist/index.cjs
NODE_ENV=production node dist/index.cjs        # serves on :5000
```

When deployed via `deploy_website`, the static bundle is served from S3 and `/api/*` calls are proxied to the Express server via the `__PORT_5000__` token that `client/src/lib/queryClient.ts` rewrites at runtime.

---

## Folder map (the important bits)

```
client/src/
  App.tsx                      # routes + AuthProvider + RoleLanding
  lib/
    auth.tsx                   # useAuth() + setCurrentUserId()
    queryClient.ts             # apiRequest with __PORT_5000__ substitution
    format.ts                  # currency, dates, big-number formatting
  components/
    brand.tsx                  # CreatorXLogo, CreatorXMark, Icon (Material Symbols)
    creator-shell.tsx          # 480px mobile column + bottom nav
    admin-shell.tsx            # desktop sidebar (9 nav items)
  pages/
    onboarding.tsx / login.tsx / signup.tsx
    connect-socials.tsx / niches.tsx / discover.tsx
    creator/                   # home, campaign-details, my-campaigns, inbox,
                               # chat-thread, new-message, notifications,
                               # earnings, withdraw, profile, settings,
                               # community, event-details
    admin/                     # dashboard, creators, creator-detail, brands,
                               # campaigns, applications, deliverables,
                               # payouts, community, audit
server/
  index.ts     routes.ts     storage.ts     seed.ts
shared/
  schema.ts                    # single source of truth
supabase/
  migrations/                  # Drizzle-generated tables/enums/FKs
```

---

## Design tokens

Defined in `client/src/index.css`:

| Token | Value |
| --- | --- |
| Background | `#050505` |
| Surface | `#121212` |
| Primary | `#1337ec` (royal blue) |
| Money accent | `#6ea0ff` |
| Display font | Plus Jakarta Sans |
| Body font | Noto Sans |
| Icon set | Material Symbols Rounded |
| Corner radius | `rounded-2xl` / `rounded-3xl` on cards, `rounded-full` on pills |
| CTA effect | `.glow-primary` — neon drop-shadow utility |

Dark mode is forced — the app never ships a light variant.
