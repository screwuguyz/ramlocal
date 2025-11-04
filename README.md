This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup

1) Environment variables (.env.local)

Create a file named `.env.local` in the project root using the template below (you can also copy `env.local.example` and rename it to `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin

# Pushover notifications (Application API Token/Key, not the User Key)
PUSHOVER_TOKEN=

# Optional: If you proxy notify via a deployed URL, otherwise leave empty
# NEXT_PUBLIC_NOTIFY_URL=https://your-app.example.com
```

Notes:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used by `app/api/login/route.ts` to set an admin cookie (`ram_admin`).
- `PUSHOVER_TOKEN` must be your Pushover Application API Token/Key. Each teacher’s personal `Pushover User Key` should be entered from the UI into the “Pushover User Key” field.
- If you change `.env.local`, restart the dev server so the new values are loaded.

2) Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Tip (Windows, Turkish chars): If you see "stream did not contain valid UTF-8" or characters look broken, normalize encodings before running:

PowerShell:

```
./scripts/normalize-encoding.ps1
```

This converts any UTF-16/BOM files to UTF-8 (no BOM) without corrupting Turkish characters.

3) Production (Windows helper)

Double-click `RAM-BAŞLAT.bat` or run the steps inside it:

```bash
npm install
npm run build
npm run api   # starts json-server on :4000
npm start     # Next.js on :3000
```

## Pushover Test

- Ensure `.env.local` contains `PUSHOVER_TOKEN`.
- In the UI, set a teacher’s `Pushover User Key`.
- Click “Test Gönder” — you will see a success or an error message returned from `/api/notify`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Global, Cross‑Browser Persistence

This project can persist the full app state centrally via Supabase so that all browsers/devices see the same data until an admin changes it.

Setup:

- Add these to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- Create the table once in your Supabase project (SQL editor):

```sql
create table if not exists app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
```

How it works:

- On startup, the app fetches `/api/state` (Supabase). If data exists, it overrides localStorage.
- When the admin changes teachers/cases/history/settings, the app POSTs the new state to `/api/state` and also broadcasts via Realtime so other tabs update instantly.
- localStorage remains as a fallback cache only.
